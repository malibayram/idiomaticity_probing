#!/usr/bin/env python3
"""Build the provisional Turkish NCIMP-compatible lexical inventory.

The output is a curation dataset, not a human-rated gold standard.  It keeps
the paper's 103/88/89 type-level class distribution and leaves the gold
0--5 compositionality score empty for later native-speaker annotation.
"""

from __future__ import annotations

import bz2
import csv
import json
import os
import re
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "ncimp" / "TR" / "turkish_ncimp_inventory.csv"
TATOEBA_CACHE = Path("/tmp/tur_sentences_detailed.tsv.bz2")
TDK_CACHE = Path("/tmp/tdk_gts_ncimp_2026-06-23.json")
TATOEBA_URL = (
    "https://downloads.tatoeba.org/exports/per_language/tur/"
    "tur_sentences_detailed.tsv.bz2"
)
TATOEBA_LICENSE = "CC BY 2.0 FR"

# These I/PC examples were inspected for the intended figurative/lexicalized
# sense and for acceptable Turkish.  Other exact matches are often literal
# homographs (for example, literal "arka kapı" or astronomical "kara delik")
# and therefore must not enter the dataset automatically.
REVIEWED_TATOEBA_FIRST = {
    "ayak bağı",
    "barut fıçısı",
    "beyaz perde",
    "çetin ceviz",
    "çocuk oyuncağı",
    "dünya evi",
    "ekmek kapısı",
    "göz bebeği",
    "göz boyama",
    "günah keçisi",
    "hayal kırıklığı",
    "kara kutu",
    "kurtlar sofrası",
    "kuzu postu",
    "nabız yoklama",
    "pamuk ipliği",
    "pembe dizi",
    "sır küpü",
    "yağlı kapı",
    "gönül gözü",
    "kara gün",
    "ölüm kalım",
    "soğuk duş",
    "beyin göçü",
    "beyin fırtınası",
    "cadı kazanı",
    "çorap söküğü",
    "dönüm noktası",
    "gri alan",
    "kırılma noktası",
    "merdiven altı",
    "şamar oğlanı",
    "ateş hattı",
    "cam tavan",
    "çıkış yolu",
    "deniz kurdu",
    "fikir babası",
    "göz kararı",
    "hayat arkadaşı",
    "hayat dersi",
    "kara liste",
    "kara mizah",
    "kuyruk acısı",
    "ruh ikizi",
    "vicdan azabı",
    "altın çağ",
    "çamur atma",
    "çifte standart",
    "kara leke",
    "kırık kalp",
    "kilit isim",
    "kuru kalabalık",
    "nazar boncuğu",
    "ölüm sessizliği",
    "soğuk savaş",
    "umut ışığı",
    "yasak aşk",
    "zaman kaybı",
    "acı gerçek",
    "demir yumruk",
    "insan sarrafı",
    "linç kültürü",
    "para tuzağı",
}

# Exact corpus matches removed during manual language/sense review.  Most are
# translationese, fragments, a wrong parse (for example "ikinci el kitabı"),
# or a literal sense that does not instantiate the selected MWE meaning.
REJECTED_TATOEBA_SENTENCES = {
    "Bu, onları bir ders kitabı için, bir uygulama için, bir araştırma projesi için, her şey için yeniden serbestçe kullanabileceğin anlamına gelir.",
    "Senin bu iş planı neredeyse çok iyimser görünüyor. Bütün söyleyebileceğim onun bir boş hayalden daha fazlası olduğunu ummamdır.",
    "İnsan kaynaklarına iş planı vermemiz gerekir.",
    "Üniversite, Mark Zuckerberg'ı veri tabanını hacklediği için disipline verdi.",
    "Hacker şirketin veri tabanında bulunan hassas dosyalara erişimi kazandı.",
    "Senin cep telefonun var mı?",
    "Onun cep telefonu, diğer telefonları engelleyen radyo emisyonu üretti.",
    "Benim en sevdiğim çocuk kitabı Söğütlerdeki Rüzgar.",
    "Havalanından şehir merkezine hangi demir yolu hattını kullanacağımı bana söyle lütfen.",
    "Şu köşe yaz köşesi, şu köşe kış köşesi, ortada su şişesi.",
    "Yemek masasına doğru yol alın! Akşam yemeği sunuldu.",
    "Otobüs durağına on dakikalık yürüyüş.",
    "Ben bütün gün bilgisayar ekranı önünde otururum, bu yüzden elektro-manyetik dalgalar tarafından oldukça şiddetli şekilde bombardıman edilirim.",
    "Banka hesabını bilmemizde bir sakınca var mı?",
    "Tom'un Cayman Adaları bir banka hesabı var.",
    "En sevdiğiniz TV eğitim programı nedir?",
    "O, sınav sonucu hakkında endişeli.",
    "Sınav sonucu ile ilgili endişem vardı.",
    "Senin üniversite kampüsünde bira içmek sorun yaratır mı?",
    "Benim yazdığım yemek tarifi kitabını gördün mü?",
    "Tom maaş bordrosundan maaş bordrosuna yaşar.",
    "Malcom birçok mahkeme kararında onun adını görmekten usandığı için Tom'u öldürdü.",
}

NEUTRAL_OVERRIDES = {
    "çantada keklik": "Bu iş çantada keklik.",
    "hava cıva": "Bu sözler hava cıva.",
    "içler acısı": "Bu durum içler acısı.",
    "kıl payı": "Aradaki fark kıl payı.",
    "kuş uçuşu": "Mesafe kuş uçuşu hesaplandı.",
    "ölüm kalım": "Bu bir ölüm kalım meselesi.",
    "süt liman": "Ortalık süt liman.",
    "toz pembe": "Görüntü toz pembe.",
    "merdiven altı": "Bu bir merdiven altı üretim.",
    "tezgâh altı": "Bu bir tezgâh altı satış.",
    "zehir zemberek": "Bu zehir zemberek bir açıklama.",
}


# class | canonical form | normalized Turkish meaning | semantic kind
_DATA = r"""
I|acı reçete|Toplum için kısa vadede zorlayıcı olan sert önlem paketi|policy
I|açık çek|Sınırı önceden belirlenmemiş yetki veya hareket serbestliği|concept
I|ağır top|Bir çevrede etkisi ve gücü çok yüksek kişi|person
I|akıl küpü|Çok bilgili ve zeki kabul edilen kişi|person
I|altın bilezik|Her koşulda geçim sağlayabilecek meslek veya beceri|concept
I|arka bahçe|Bir kurumun ya da gücün dolaylı biçimde denetlediği alan|place
I|arka kapı|Resmî olmayan, gizli veya dolaylı işlem yolu|concept
I|ayak bağı|İlerlemeyi engelleyen kişi, yükümlülük veya durum|obstacle
I|ayak oyunu|Birini saf dışı bırakmaya yönelik gizli düzen veya hile|concept
I|ateş çemberi|Her yanı ciddi tehlikelerle çevrili durum veya bölge|situation
I|baba ocağı|Kişinin doğup büyüdüğü aile evi|place
I|balık hafızası|Çok çabuk unutma özelliği|concept
I|barut fıçısı|Küçük bir kıvılcımla büyük çatışmaya dönüşebilecek ortam|situation
I|beyaz perde|Sinema sanatı veya sinema dünyası|concept
I|bit yeniği|Bir işte kuşku uyandıran gizli aksaklık veya hile|concept
I|can damarı|Bir yapının yaşaması için vazgeçilmez olan temel unsur|concept
I|can pazarı|İnsanların ölüm tehlikesi içinde kurtulmaya çalıştığı kargaşa|situation
I|can simidi|Zor durumda kurtuluş sağlayan kişi, imkân veya çözüm|support
I|çantada keklik|Elde edilmesi kesin ve çok kolay görülen iş veya sonuç|concept
I|çetin ceviz|Başa çıkılması ya da çözülmesi çok zor kişi veya mesele|person_or_issue
I|çocuk oyuncağı|Yapılması son derece kolay iş|concept
I|dünya evi|Evlilik kurumu veya evlilik hayatı|concept
I|ekmek kapısı|Düzenli geçim sağlayan iş veya gelir kaynağı|support
I|fildişi kule|Toplumun gerçeklerinden uzak, yalıtılmış düşünce çevresi|place
I|göz bebeği|Çok sevilen ve özenle korunan kişi veya şey|person_or_thing
I|göz boyama|Gerçeği gizleyip iyi izlenim yaratmaya yönelik aldatma|concept
I|günah keçisi|Başkalarının kusurunun haksız yere yüklendiği kişi veya grup|person
I|hava cıva|İçi boş, değersiz veya ciddi olmayan söz ve işler|concept
I|hayal kırıklığı|Beklentinin gerçekleşmemesinden doğan üzüntü|emotion
I|içler acısı|Büyük üzüntü ve acıma uyandıran durum|situation
I|kağıt kaplan|Güçlü görünmesine karşın gerçekte etkisiz kişi veya yapı|person_or_org
I|kapalı kutu|İç işleyişi veya düşünceleri bilinmeyen kişi ya da sistem|person_or_org
I|kara kutu|İç işleyişi dışarıdan anlaşılamayan sistem veya birim|system
I|kara koyun|Bir aile ya da toplulukta kötü tanınan, aykırı kişi|person
I|kara delik|Kaynakları sürekli tükettiği hâlde karşılık üretmeyen alan|system
I|kırmızı çizgi|Aşılmasına veya tartışılmasına izin verilmeyen kesin sınır|concept
I|kör düğüm|Çözümü çok güçleşmiş karmaşık sorun|issue
I|kurtlar sofrası|Acımasız çıkar çatışmalarının yaşandığı rekabet ortamı|situation
I|kuzu postu|Zararsız görünmek için kullanılan aldatıcı dış görünüş|concept
I|laf salatası|Uzun, karışık ve anlamlı bir sonuç vermeyen konuşma|concept
I|masa başı|Sahadan uzak biçimde yürütülen büro işi veya yaklaşımı|concept
I|mayın tarlası|Her adımı beklenmedik sorun çıkarabilecek konu veya ortam|situation
I|maymun iştahı|Bir şeye çabuk heveslenip ondan hızla vazgeçme huyu|concept
I|nabız yoklama|Karar vermeden önce ilgili kişilerin tepkisini ölçme girişimi|process
I|pamuk ipliği|Kopması çok kolay, son derece zayıf bağ veya denge|concept
I|pembe dizi|Duygusal ilişkileri öne çıkaran, uzun soluklu televizyon dizisi|concept
I|perde arkası|Bir olayın kamuya görünmeyen gizli yönleri|concept
I|sağmal inek|Sürekli kazanç elde etmek için sömürülen kişi veya kaynak|support
I|sır küpü|Bildiği sırları açıklamayan, çok ketum kişi|person
I|süt liman|Hiçbir gerginliğin veya hareketliliğin bulunmadığı sakin durum|situation
I|yağlı kapı|Büyük ve kolay kazanç sağlayan iş ya da kişi|support
I|yılan hikayesi|Bir türlü sonuçlanmayan, gereksiz yere uzayan iş|issue
I|züğürt tesellisi|Başarısızlığı veya yoksunluğu önemsiz gösteren avunma|concept
I|dost kazığı|Güvenilen bir dosttan gelen ağır zarar veya ihanet|concept
I|fil hafızası|Çok güçlü ve ayrıntılı hatırlama yeteneği|concept
I|geyik muhabbeti|Ciddi amacı olmayan uzun ve rahat sohbet|concept
I|gönül gözü|Sezgiyle ve içten kavrama yeteneği|concept
I|göz hapsi|Bir kişiyi sürekli ve yakından izleme durumu|process
I|göz nuru|Yoğun emek ve özenle ortaya konmuş değerli ürün|thing
I|hayat öpücüğü|Yaşamsal tehlikedeki kişiye uygulanan suni solunum veya kurtarıcı destek|support
I|kara gün|Büyük sıkıntı ve felaket yaşanan dönem|situation
I|kıl payı|Bir sonucun gerçekleşmesine çok az kala oluşan dar fark|concept
I|kuş uçuşu|İki nokta arasındaki doğrusal ve en kısa uzaklık|concept
I|ölüm kalım|Sonucu yaşamsal önem taşıyan kritik durum|situation
I|para babası|Çok zengin ve mali gücü yüksek kişi|person
I|piyasa kurdu|Bir piyasanın işleyişini ve hilelerini çok iyi bilen deneyimli kişi|person
I|saatli bomba|Yakında ciddi zarar doğurması beklenen gizli tehlike|situation
I|sıcak para|Kısa vadeli kazanç için hızla ülke değiştiren sermaye|concept
I|soğuk duş|Beklenmedik biçimde heves kıran kötü haber veya gelişme|situation
I|tatlı dil|Nazik, yumuşak ve ikna edici konuşma biçimi|concept
I|tekne kazıntısı|Bir ailenin en küçük ve genellikle son çocuğu|person
I|yol haritası|Bir hedefe ulaşmak için izlenecek aşamaları gösteren plan|document
I|beyin göçü|Nitelikli insanların çalışmak amacıyla başka ülkeye gitmesi|process
I|beyin fırtınası|Kısa sürede çok sayıda fikir üretmeye yönelik grup çalışması|process
I|cadı kazanı|Sürekli çekişme, dedikodu ve karışıklık bulunan ortam|situation
I|çorap söküğü|Başlayınca birbirini izleyerek kolayca ilerleyen işler dizisi|process
I|demir perde|Ülkeler veya gruplar arasında bilgi ve geçişi engelleyen katı ayrım|concept
I|dip dalga|Yüzeyde görünmeden büyüyen toplumsal eğilim veya tepki|concept
I|domino etkisi|Bir olayın zincirleme biçimde başka olayları tetiklemesi|process
I|dönüm noktası|Bir sürecin yönünü kökten değiştiren önemli olay|event
I|fırsat penceresi|Bir işi gerçekleştirmek için kısa süreli uygun koşullar|concept
I|gri alan|Kuralların veya doğruların kesin olmadığı belirsiz konu|concept
I|güven oyu|Bir yönetimin görevini sürdürmesine verilen resmî destek|event
I|ince ayar|Küçük ama sonucu belirgin biçimde iyileştiren düzenleme|process
I|kalp kırıklığı|Duygusal incinme ve derin üzüntü|emotion
I|kırılma noktası|Bir sürecin davranışını veya yönünü değiştirdiği kritik eşik|concept
I|kör nokta|Fark edilmeyen eksiklik veya değerlendirme dışı kalan alan|concept
I|köprü başı|Daha geniş bir alana yayılmak için elde tutulan stratejik konum|place
I|kukla hükümet|Başka bir gücün yönlendirmesiyle hareket eden yönetim|organization
I|kurşun asker|Sorgulamadan ve duygusuzca emir uygulayan kişi|person
I|merdiven altı|Kayıt ve denetim dışında, uygunsuz koşullarda yapılan üretim|concept
I|nalıncı keseri|Her durumda çıkarı kendine yönelten tutum|concept
I|rüşvet çarkı|Rüşvetle işleyen düzenli çıkar ağı|system
I|sabır taşı|Dert dinleyen ve sıkıntılara sessizce katlanan kişi|person
I|sis perdesi|Gerçeğin anlaşılmasını engelleyen belirsizlik veya yanıltma|concept
I|sürpriz yumurta|İçinden beklenmedik sonuçlar çıkabilecek kişi, olay veya paket|thing
I|şamar oğlanı|Her yanlışın sorumluluğu yüklenen ve sürekli hırpalanan kişi|person
I|şöhret basamağı|Ün kazanmaya yarayan kişi, olay veya fırsat|support
I|taht kavgası|Yönetim gücünü ele geçirmek için yürütülen sert mücadele|process
I|tezgâh altı|Resmî denetim dışında gizlice yapılan satış veya işlem|concept
I|vitrin süsü|Yalnızca iyi görüntü vermek için öne çıkarılan etkisiz unsur|thing
I|zaman tüneli|Geçmiş bir dönemi yeniden yaşatıyormuş duygusu veren ortam|place
I|kartopu etkisi|Küçük başlayan bir gelişmenin giderek hızlanıp büyümesi|process
PC|aslan payı|Paylaşımda bir kişiye düşen en büyük bölüm|concept
PC|ateş hattı|Çatışmanın veya doğrudan tehlikenin en yoğun olduğu bölge|place
PC|beyin takımı|Bir kurumun strateji üreten en güçlü uzman grubu|organization
PC|cam tavan|Belirli grupların yükselmesini görünmez biçimde engelleyen sınır|obstacle
PC|can yoldaşı|Kişinin çok yakın ve güvenilir arkadaşı|person
PC|çark dişi|Bir düzenin işleyişinde küçük fakat gerekli parça veya kişi|thing
PC|çıkış yolu|Zor bir durumdan kurtulmayı sağlayacak çözüm|concept
PC|deniz kurdu|Denizde çok deneyim kazanmış usta denizci|person
PC|dikenli yol|Güçlükler ve risklerle dolu süreç|process
PC|ekmek teknesi|Kişinin geçimini sağladığı iş, araç veya işletme|support
PC|eşek şakası|Kaba, tehlikeli veya incitici şaka|concept
PC|fikir babası|Bir düşünceyi ilk geliştiren veya ortaya atan kişi|person
PC|gönül bağı|İnsanları birbirine bağlayan güçlü duygusal yakınlık|concept
PC|gönül yarası|Aşk veya ayrılık nedeniyle süren duygusal acı|emotion
PC|göz kararı|Bir ölçü aracı kullanmadan bakarak yapılan yaklaşık ölçüm|process
PC|hayat arkadaşı|Kişinin yaşamını paylaştığı eşi|person
PC|hayat dersi|Yaşanan olaydan çıkarılan kalıcı ve önemli öğreti|concept
PC|kara liste|Sakıncalı görülerek işlem yapılmaması istenen kişi veya kurum listesi|document
PC|kara para|Yasa dışı yollarla kazanılan veya kaynağı gizlenen para|concept
PC|kara mizah|Acı, korkutucu veya trajik olayları gülmeceyle işleyen mizah türü|concept
PC|kara propaganda|Kaynağı gizlenen ve yanıltıcı bilgiye dayanan propaganda|process
PC|keçi inadı|Gerekçelere rağmen sürdürülen aşırı direnç ve inat|concept
PC|kilit nokta|Bir sorunun çözümünü veya sürecin sonucunu belirleyen bölüm|concept
PC|köşe taşı|Bir yapının veya düşüncenin temelini oluşturan önemli unsur|thing
PC|kuyruk acısı|Geçmişte uğranan zarardan doğan kalıcı öfke|emotion
PC|omuz yükü|Bir kişinin üstlenmek zorunda kaldığı ağır sorumluluk|concept
PC|puslu hava|Belirsizlik ve güvensizliğin egemen olduğu ortam|situation
PC|ruh ikizi|Duygu ve düşünce bakımından kişiye çok benzeyen yakın kişi|person
PC|sahne arkası|Bir gösterinin veya olayın izleyiciye görünmeyen hazırlık bölümü|place
PC|sinir harbi|Tarafların birbirini psikolojik baskıyla yıprattığı mücadele|process
PC|umut kapısı|İyileşme veya kurtuluş beklenen kişi, kurum ya da imkân|support
PC|vicdan azabı|Yanlış bir davranıştan sonra duyulan yoğun suçluluk|emotion
PC|zehir zemberek|Çok sert, kırıcı ve öfke dolu söz veya açıklama|concept
PC|altın çağ|Bir alanın en başarılı ve verimli dönemi|situation
PC|boş laf|Gerçek içerik veya sonuç taşımayan söz|concept
PC|çamur atma|Kanıtsız suçlamalarla birinin itibarını zedeleme|process
PC|çifte standart|Benzer durumlara çıkar doğrultusunda farklı ölçüt uygulama|concept
PC|el kitabı|Bir konu hakkında temel ve pratik bilgiler veren başvuru kitabı|document
PC|göz dağı|Birini korkutup davranışından vazgeçirmek için yapılan tehdit|concept
PC|kara leke|Bir kişinin veya kurumun itibarını kalıcı biçimde zedeleyen olay|event
PC|kara tablo|Çok olumsuz durumu gösteren genel görünüm|concept
PC|kırık kalp|Aşk veya kayıp nedeniyle incinmiş duygusal durum|emotion
PC|kilit isim|Bir işin başarıya ulaşmasında belirleyici rolü olan kişi|person
PC|kör inanç|Kanıt ve sorgulama kabul etmeyen katı inanç|concept
PC|kuru gürültü|Gerçek güç veya sonuç taşımayan tehdit ve gösteriş|concept
PC|kuru kalabalık|Sayıca çok olduğu hâlde işe katkı sağlamayan topluluk|organization
PC|medya maymunu|Dikkat çekmek için medyada sürekli gösteri yapan kişi|person
PC|namus borcu|Kişinin onur gereği yerine getirmesi gerektiğine inandığı görev|concept
PC|nazar boncuğu|Kötü bakışın etkisinden koruduğuna inanılan boncuk|thing
PC|ölüm sessizliği|Hiç sesin duyulmadığı ürpertici sessizlik|situation
PC|para musluğu|Sürekli ve kolay para sağlayan kaynak|support
PC|reklam yüzü|Bir markayı tanıtmak üzere kamu önüne çıkarılan kişi|person
PC|rüya takımı|Alanındaki en başarılı kişilerden kurulan ekip|organization
PC|sabun köpüğü|Kısa sürede dağılan, kalıcı olmayan başarı veya ilgi|concept
PC|sahte cennet|Dışarıdan kusursuz görünse de gerçekte sorunlu ortam|place
PC|ses duvarı|Bir cismin ses hızına ulaşırken karşılaştığı aerodinamik eşik|concept
PC|sevgi seli|Çok yoğun ve topluca gösterilen sevgi|emotion
PC|soğuk savaş|Tarafların doğrudan çatışmadan sürdürdüğü siyasi mücadele|process
PC|söz düellosu|Tarafların karşılıklı sert sözlerle yürüttüğü tartışma|process
PC|şans kapısı|Başarı veya kazanç sağlayabilecek önemli fırsat|support
PC|taş yürek|Acıma ve şefkat göstermeyen duygu yapısı|concept
PC|umut ışığı|Zor durumda olumlu sonuç beklemeyi sağlayan küçük belirti|concept
PC|vergi cenneti|Çok düşük vergi uygulayarak sermaye çeken ülke veya bölge|place
PC|vicdan muhasebesi|Kişinin davranışlarını ahlaki açıdan içten değerlendirmesi|process
PC|yasak aşk|Toplumsal veya hukuki nedenlerle kabul edilmeyen aşk ilişkisi|concept
PC|yıldız oyuncu|Takımında üstün başarı ve ün kazanmış oyuncu|person
PC|zaman kaybı|Harcanan zamana değmeyecek iş veya uğraş|concept
PC|altın fırsat|Başarı için çok değerli ve ender imkân|concept
PC|acı gerçek|Kabul edilmesi güç fakat doğru olan durum|concept
PC|boş vaat|Yerine getirilmesi amaçlanmayan veya mümkün olmayan söz|concept
PC|çürük elma|Bulunduğu gruba zarar veren kötü kişi veya unsur|person_or_thing
PC|demir yumruk|Çok sert ve baskıcı yönetim gücü|concept
PC|derin devlet|Resmî yapı dışında gizlice etkili olduğu ileri sürülen devlet ağı|organization
PC|dert küpü|Çok sayıda sıkıntısı olan veya sürekli dert anlatan kişi|person
PC|gizli el|Olayları görünmeden yönlendiren kişi veya güç|person_or_org
PC|güç zehirlenmesi|Yetki kazanan kişinin ölçüsüz ve kibirli davranmaya başlaması|concept
PC|hava korsanı|Bir uçağı zorla ele geçiren kişi|person
PC|hız tutkusu|Çok hızlı hareket etmeye duyulan güçlü istek|emotion
PC|insan sarrafı|İnsanların karakterini kısa sürede doğru değerlendiren kişi|person
PC|kan gölü|Çok sayıda insanın yaralandığı veya öldüğü kanlı ortam|situation
PC|korku tüneli|İçinden geçenleri korkutmak için hazırlanmış eğlence düzeneği veya ürkütücü süreç|place
PC|kriz masası|Bir krizi yönetmek için kurulan geçici koordinasyon ekibi|organization
PC|linç kültürü|Bir kişiyi topluca ve ölçüsüz biçimde hedef alma alışkanlığı|concept
PC|makam sarhoşluğu|Yetki sahibi olduktan sonra ölçüsünü yitirme durumu|concept
PC|para tuzağı|İnsanlardan haksız veya gereksiz ödeme almaya yönelik düzen|concept
PC|rant kapısı|Haksız ve sürekli kazanç sağlanan alan|support
PC|sevgi pıtırcığı|Sevecen ve neşeli tavrıyla ilgi uyandıran kişi|person
PC|suç makinesi|Çok sayıda suçu tekrar tekrar işleyen kişi|person
C|araştırma projesi|Belirli bir soruyu yöntemli biçimde incelemek için planlanan çalışma|process
C|iş planı|Bir girişimin hedeflerini, yöntemini ve mali yapısını açıklayan plan|document
C|veri tabanı|Düzenli biçimde saklanan ve sorgulanabilen veri bütünü|system
C|cep telefonu|Taşınabilir hücresel iletişim telefonu|thing
C|çocuk kitabı|Çocuk okurlar için hazırlanmış kitap|document
C|kahve fincanı|Kahve içmek için kullanılan küçük fincan|thing
C|okul bahçesi|Bir okulun çevresindeki açık kullanım alanı|place
C|şehir merkezi|Bir şehrin idari veya ticari bakımdan merkez bölgesi|place
C|sınıf öğretmeni|İlköğretimde bir sınıfın temel derslerinden sorumlu öğretmen|person
C|trafik ışığı|Araç ve yaya geçişini renkli sinyallerle düzenleyen ışık|thing
C|su şişesi|Su koymak veya taşımak için kullanılan şişe|thing
C|masa lambası|Masa üzerinde kullanılan aydınlatma lambası|thing
C|duvar saati|Duvara asılmak üzere tasarlanmış saat|thing
C|yemek masası|Yemek yemek için kullanılan masa|thing
C|kitap kapağı|Bir kitabın önünü ve arkasını koruyan dış bölüm|thing
C|bahçe kapısı|Bir bahçeye giriş ve çıkışı sağlayan kapı|thing
C|otobüs durağı|Otobüslerin yolcu almak için durduğu yer|place
C|tren istasyonu|Trenlerin yolcu veya yük için durduğu tesis|place
C|havaalanı terminali|Havaalanında yolcu işlemlerinin yapıldığı bina|place
C|bilgisayar ekranı|Bilgisayarın görsel çıktısını gösteren ekran|thing
C|telefon numarası|Bir telefon hattını tanımlayan rakam dizisi|concept
C|internet bağlantısı|Bir cihazın internete erişmesini sağlayan bağlantı|concept
C|elektrik faturası|Tüketilen elektrik için düzenlenen ödeme belgesi|document
C|kredi kartı|Banka kredisini kullanarak ödeme yapmayı sağlayan kart|thing
C|banka hesabı|Bir banka nezdinde para işlemleri için açılan hesap|concept
C|sağlık sigortası|Sağlık giderlerini belirli koşullarla karşılayan sigorta|concept
C|iş görüşmesi|İşveren ile aday arasında işe alım amacıyla yapılan görüşme|event
C|proje yönetimi|Bir projenin kaynaklarını ve aşamalarını planlama süreci|process
C|kalite kontrolü|Ürün veya hizmetin belirlenen niteliklere uyumunu denetleme işi|process
C|müşteri hizmetleri|Müşterilere bilgi ve destek sağlayan hizmet birimi|organization
C|satış raporu|Belirli dönemdeki satış verilerini sunan rapor|document
C|üretim hattı|Bir ürünün aşamalı olarak üretildiği düzenek|system
C|enerji tüketimi|Bir süreçte kullanılan enerji miktarı|concept
C|su deposu|Suyu biriktirmek ve saklamak için kullanılan depo|thing
C|güneş paneli|Güneş enerjisini elektrik veya ısıya dönüştüren panel|thing
C|rüzgâr türbini|Rüzgâr enerjisinden elektrik üreten türbin|thing
C|atık yönetimi|Atıkların toplanması, işlenmesi ve bertaraf edilmesi süreci|process
C|çevre politikası|Çevrenin korunmasına ilişkin ilke ve kararlar bütünü|concept
C|eğitim programı|Eğitimin amaçlarını ve içeriğini düzenleyen program|document
C|ders kitabı|Bir dersin öğretimi için hazırlanmış kitap|document
C|sınav sonucu|Bir sınav değerlendirmesi sonunda elde edilen sonuç|concept
C|öğrenci belgesi|Bir kişinin öğrenci olduğunu gösteren resmî belge|document
C|öğretmen odası|Öğretmenlerin okulda kullandığı ortak oda|place
C|üniversite kampüsü|Bir üniversitenin binalarının bulunduğu yerleşke|place
C|kütüphane kartı|Kütüphane hizmetlerinden yararlanmayı sağlayan kart|thing
C|laboratuvar cihazı|Laboratuvar çalışmasında kullanılan ölçüm veya deney cihazı|thing
C|araştırma merkezi|Belirli alanlarda araştırma yürüten kurum veya birim|organization
C|bilim kurulu|Bilimsel konularda değerlendirme yapan uzman kurulu|organization
C|haber ajansı|Haber toplayıp abonelerine dağıtan kuruluş|organization
C|gazete ilanı|Bir gazetede yayımlanan duyuru veya reklam|document
C|televizyon kanalı|Belirli bir yayın akışı sunan televizyon kuruluşu|organization
C|radyo programı|Radyoda belirli saatlerde yayımlanan içerik|event
C|film festivali|Filmlerin gösterildiği ve değerlendirildiği düzenli etkinlik|event
C|müzik öğretmeni|Müzik eğitimi veren öğretmen|person
C|tiyatro oyunu|Sahnede oynanmak üzere yazılmış veya sergilenen oyun|event
C|spor salonu|Spor yapmak için düzenlenmiş kapalı alan|place
C|futbol takımı|Futbol oynamak üzere oluşturulmuş oyuncu grubu|organization
C|basketbol maçı|İki basketbol takımı arasında oynanan karşılaşma|event
C|yarış pisti|Yarışların yapıldığı özel parkur|place
C|otel odası|Bir otelde konaklama için ayrılmış oda|place
C|tatil köyü|Konaklama ve dinlenme hizmetlerini birlikte sunan turistik tesis|place
C|seyahat acentesi|Gezi, bilet ve konaklama hizmetleri satan işletme|organization
C|uçak bileti|Belirli bir uçuşta yolculuk hakkını gösteren bilet|document
C|pasaport kontrolü|Sınır geçişinde pasaportların denetlenmesi işlemi|process
C|gümrük kapısı|Yolcu ve malların gümrük işlemlerinden geçtiği sınır noktası|place
C|şehir haritası|Bir şehrin yollarını ve önemli yerlerini gösteren harita|document
C|sokak lambası|Sokağı aydınlatmak için kullanılan lamba|thing
C|park yeri|Bir aracın park etmesi için ayrılmış alan|place
C|çöp kutusu|Çöplerin geçici olarak toplandığı kap|thing
C|yangın alarmı|Yangını algılayıp uyarı veren sistem|thing
C|güvenlik kamerası|Bir alanı güvenlik amacıyla görüntüleyen kamera|thing
C|kapı kilidi|Bir kapının açılmasını engelleyen kilit|thing
C|pencere camı|Pencere açıklığını örten cam parçası|thing
C|mutfak dolabı|Mutfak eşyası ve yiyecek saklamak için kullanılan dolap|thing
C|yatak odası|Uyumak için düzenlenmiş oda|place
C|banyo aynası|Banyoda kullanılan ayna|thing
C|çamaşır makinesi|Çamaşırları otomatik olarak yıkayan makine|thing
C|bulaşık makinesi|Bulaşıkları otomatik olarak yıkayan makine|thing
C|ekmek bıçağı|Ekmek kesmek için kullanılan bıçak|thing
C|çay kaşığı|Çay karıştırmakta kullanılan küçük kaşık|thing
C|yemek tarifi|Bir yemeğin malzeme ve yapım aşamalarını anlatan tarif|document
C|market arabası|Alışveriş sırasında ürün taşımak için kullanılan tekerlekli araç|thing
C|alışveriş listesi|Satın alınacak ürünleri sıralayan liste|document
C|fiyat etiketi|Bir ürünün fiyatını gösteren etiket|document
C|maaş bordrosu|Çalışanın ücret ve kesintilerini gösteren belge|document
C|vergi dairesi|Vergi işlemlerini yürüten kamu birimi|organization
C|mahkeme kararı|Bir mahkemenin yargılama sonunda verdiği karar|document
C|seçim sonucu|Oyların sayılmasıyla belirlenen seçim neticesi|concept
C|posta kutusu|Mektup ve diğer posta gönderilerinin bırakıldığı kutu|thing
"""


# Curator-authored, sense-controlled contexts for the non-compositional and
# partly compositional strata.  A reviewed open-corpus sentence, when one is
# available, is used first; these supply the remaining slots.
_CUSTOM_I = r"""
acı reçete|Hükümet bütçe açığını kapatmak için acı reçete açıkladı.|Sendikalar çalışanlara yüklenen acı reçeteye tepki gösterdi.|Uzmanlar acı reçete uygulanmadan da çözüm bulunabileceğini savundu.
açık çek|Yönetim müdüre harcamalar konusunda açık çek vermedi.|Bu yetkiyi açık çek olarak yorumlamak yanlış olur.|Meclis kararla birlikte yürütmeye adeta açık çek sundu.
ağır top|Partinin ağır topu seçim kampanyasına bugün katıldı.|Toplantıda sektörün ağır topları aynı masada buluştu.|Kulübün ağır topu transfer görüşmelerini bizzat yürüttü.
akıl küpü|Sınıfın akıl küpü bu soruyu birkaç saniyede çözdü.|Herkes onu akıl küpü sanıyor ama o da bazen yanılıyor.|Ekibin akıl küpü yine pratik bir çözüm buldu.
altın bilezik|Babam bir meslek öğrenmenin altın bilezik olduğunu söylerdi.|Yabancı dil onun kolunda altın bilezik oldu.|Bu ustalık, zor günlerde işe yarayan bir altın bilezik sayılır.
arka bahçe|Şirket küçük tedarikçileri kendi arka bahçesi gibi yönetiyordu.|Bölgenin başka bir ülkenin arka bahçesi sayılmasına karşı çıktılar.|Kulüp, altyapıyı A takımın arka bahçesi olarak görüyor.
arka kapı|İhaleyi arka kapı ilişkileriyle alma girişimi soruşturuluyor.|Sorunu arka kapı diplomasisiyle çözmeye çalıştılar.|Yasağın arka kapı yöntemleriyle aşılmasına izin verilmedi.
ayak bağı|Gereksiz bürokrasi yatırımcıya ayak bağı oluyor.|Eski borçlar şirketin büyümesinde ciddi bir ayak bağıydı.|Bu kural, araştırmacılar için ayak bağı hâline geldi.
ayak oyunu|Rakibini ayak oyunuyla saf dışı bırakmaya çalıştı.|Seçim öncesindeki ayak oyunu iddiaları parti içinde tepki çekti.|Bu kararın ardında bir ayak oyunu olduğundan kuşkulanıyorlar.
ateş çemberi|Köy, çatışmalar başlayınca ateş çemberinin ortasında kaldı.|Takım son haftalarda tam bir ateş çemberinden geçiyor.|İtfaiyeciler ateş çemberi içindeki ailelere ulaşmaya çalıştı.
baba ocağı|Yıllar sonra baba ocağına dönmek onu duygulandırdı.|Bayramda bütün kardeşler baba ocağında toplandı.|Baba ocağından ayrıldığında henüz on sekiz yaşındaydı.
balık hafızası|Balık hafızası yüzünden verdiği sözleri hemen unutuyor.|Seçmenin balık hafızasına sahip olduğunu düşünmek büyük hata.|Bu kadar balık hafızasıyla ayrıntıları nasıl hatırlayacaksın?
barut fıçısı|Sınırdaki gerginlik bölgeyi barut fıçısına çevirdi.|Küçük bir olay bu barut fıçısını patlatabilir.|Uzmanlar kenti toplumsal bir barut fıçısı olarak nitelendirdi.
beyaz perde|Roman gelecek yıl beyaz perdeye uyarlanacak.|Oyuncu on yıl sonra beyaz perdeye geri döndü.|Bu hikâye beyaz perdede beklenen ilgiyi görmedi.
bit yeniği|Bu kadar kârlı teklifte mutlaka bir bit yeniği vardır.|Hesaplardaki bit yeniğini denetçi kısa sürede buldu.|Sözleşmede bir bit yeniği sezen avukat imza atmadı.
can damarı|Turizm, ada ekonomisinin can damarıdır.|Bu küçük liman kentin ticari can damarı oldu.|Sulama kanalı bölgedeki tarımın can damarı sayılıyor.
can pazarı|Deprem sırasında sokaklarda tam bir can pazarı yaşandı.|Yangın büyüyünce otelde can pazarı kuruldu.|Kazada can pazarı yaşanırken ekipler yaralılara ulaştı.
can simidi|Acil kredi küçük işletmeler için can simidi oldu.|Bu burs, eğitimini sürdürmesi için gerçek bir can simidiydi.|Son dakikadaki sipariş fabrikaya can simidi gibi yetişti.
çantada keklik|Rakibini zayıf gören takım maçı çantada keklik sandı.|İhaleyi çantada keklik görmeleri büyük yanılgıydı.|Seçim hiçbir aday için çantada keklik değil.
çetin ceviz|Yeni savcı, suç örgütü için çetin ceviz çıktı.|Bu matematik sorusu beklediğimden çetin cevizmiş.|Müzakerelerde karşılarında çetin ceviz bir heyet buldular.
çocuk oyuncağı|Bu dağa kışın tırmanmak çocuk oyuncağı değildir.|Deneyimli usta için onarım çocuk oyuncağıydı.|İşi çocuk oyuncağı sanıp güvenlik önlemlerini ihmal etme.
dünya evi|Çift gelecek ay dünya evine girecek.|Yıllardır birlikte olan iki sanatçı sonunda dünya evinde buluştu.|Aileler gençlerin dünya evine girmesine destek verdi.
ekmek kapısı|Atölye mahallede onlarca kişiye ekmek kapısı oldu.|Teknesini kaybedince tek ekmek kapısı da kapanmıştı.|Turizm bölge halkının başlıca ekmek kapısıdır.
fildişi kule|Yazar, eleştirmenlerin fildişi kuleden konuştuğunu söyledi.|Bilim insanları fildişi kuleye kapanmak yerine toplumla buluşmalı.|Gerçek sorunları görmeyen bu kurul tam bir fildişi kulede yaşıyor.
göz bebeği|Bu proje kurumun göz bebeği hâline geldi.|En küçük torun dedesinin göz bebeğiydi.|Tarihî bina kentin göz bebeği olarak özenle korunuyor.
göz boyama|Birkaç ağaç dikmek çevre sorununda yalnızca göz boyamadır.|Raporun parlak grafikleri gerçeği gizleyen bir göz boyama çabasıydı.|Geçici indirimlerin göz boyamadan ibaret olduğu anlaşıldı.
günah keçisi|Yönetim başarısızlığın günah keçisi olarak teknik ekibi seçti.|Krizin bütün sorumluluğunu tek kişiye yükleyip günah keçisi aradılar.|Göçmenlerin ekonomik sorunlara günah keçisi yapılmasına itiraz etti.
hava cıva|Büyük vaatlerin çoğu seçimden sonra hava cıva çıktı.|Toplantıda sonuç yerine hava cıva konuşuldu.|Onun anlattıklarının hava cıva olduğunu herkes biliyordu.
hayal kırıklığı|Takımın erken elenmesi taraftarlar için büyük hayal kırıklığı oldu.|Beklediği yanıt gelmeyince derin bir hayal kırıklığı yaşadı.|Yeni ürün performansıyla tam bir hayal kırıklığı yarattı.
içler acısı|Hastanenin içler acısı durumu rapora yansıdı.|Sığınaktaki koşullar gerçekten içler acısıydı.|Tarihî yapının içler acısı hâli ziyaretçileri üzdü.
kağıt kaplan|Güçlü görünen örgütün aslında kağıt kaplan olduğu ortaya çıktı.|Rakiplerini korkutan şirket mali açıdan bir kağıt kaplandı.|Ordunun kağıt kaplan olmadığını göstermek istediler.
kapalı kutu|Yeni müdür çalışanlar için hâlâ kapalı kutu.|Sistemin karar mekanizması tam bir kapalı kutu gibi işliyor.|Bu şirketin mali yapısı yatırımcılar açısından kapalı kutu.
kara kutu|Algoritmanın kara kutu yapısı kararları açıklamayı zorlaştırıyor.|Araştırmacılar modelin kara kutusunu açmaya çalışıyor.|Kurul, ihalenin kara kutusu sayılan birimi incelemeye aldı.
kara koyun|Ailenin kara koyunu yıllar sonra kasabaya döndü.|Takımın kara koyunu ilan edilen oyuncu kendini savundu.|Her toplulukta birini kara koyun seçmek kolaydır.
kara delik|Zarar eden proje bütçede bir kara delik yarattı.|Bu kurum kamu kaynaklarını yutan bir kara delik gibi çalışıyor.|Bakım giderleri şirket için mali bir kara delik oluşturdu.
kırmızı çizgi|Basın özgürlüğü bizim için kırmızı çizgidir.|Taraflar müzakerelerde kendi kırmızı çizgilerini açıkladı.|Çocukların güvenliği konusunda kırmızı çizgisi çok netti.
kör düğüm|Yıllardır çözülemeyen mülkiyet sorunu kör düğüme dönüştü.|Görüşmelerdeki kör düğümü yeni öneri çözdü.|Dosya bürokratik bir kör düğüm hâlinde bekliyor.
kurtlar sofrası|Genç girişimci kendini bir anda kurtlar sofrasında buldu.|Siyaseti kurtlar sofrasına benzeten aday geri çekildi.|Bu piyasada ayakta kalmak için kurtlar sofrasının kurallarını bilmek gerekir.
kuzu postu|Dolandırıcı, kuzu postuyla güven kazanmaya çalıştı.|Kuzu postunun altında ne kadar acımasız olduğunu geç fark ettiler.|Zararsız görünen teklifin kuzu postu taşıdığı anlaşıldı.
laf salatası|Soruyu yanıtlamak yerine uzun bir laf salatası yaptı.|Rapor somut öneri değil, laf salatası sunuyor.|Bu açıklamadaki laf salatası gerçeği gizleyemez.
masa başı|Masa başı kararlarla sahadaki sorunlar çözülemez.|Yıllarca masa başı işte çalışınca hareket etmeyi özledi.|Proje yalnızca masa başı planlamayla yürütüldü.
mayın tarlası|Bu hassas konu siyasetçiler için bir mayın tarlasıdır.|Sözleşmenin maddeleri hukuk bakımından mayın tarlası gibi.|Diplomat, görüşmede mayın tarlasında yürür gibi dikkatliydi.
maymun iştahı|Maymun iştahı yüzünden hiçbir hobisini uzun süre sürdüremedi.|Yeni projeye de maymun iştahıyla başlayıp bırakmasından korkuyorlar.|Onun maymun iştahı ekibin planlarını sürekli değiştiriyor.
nabız yoklama|Parti, adayını açıklamadan önce nabız yoklama turuna çıktı.|Bu açıklama kamuoyunda nabız yoklama amacı taşıyordu.|Yönetim zamdan önce bir nabız yoklama toplantısı yaptı.
pamuk ipliği|Koalisyonun geleceği pamuk ipliğine bağlı.|Aralarındaki barış pamuk ipliği kadar zayıftı.|Şirketin mali dengesi bir pamuk ipliği üzerinde duruyor.
pembe dizi|Akşamları ailesiyle pembe dizi izliyor.|Kanal yeni sezonda üç pembe dizi yayımlayacak.|Eleştirmenler filmi uzatılmış bir pembe diziye benzetti.
perde arkası|Anlaşmanın perde arkasında yoğun pazarlıklar yapıldı.|Belgesel olayların perde arkasını anlatıyor.|Kararın perde arkasındaki isimler henüz bilinmiyor.
sağmal inek|Şirket sadık müşterileri sağmal inek gibi görmemeli.|Vergi sistemi küçük esnafı bir sağmal inek gibi görüyor.|Kulübün sürekli para istediği iş insanı kendini sağmal inek gibi hissetti.
sır küpü|Arkadaşım tam bir sır küpüdür; ona güvenebilirsin.|Sır küpü tanık bildiklerini yine anlatmadı.|Ailenin sır küpü olan teyze bütün geçmişi biliyordu.
süt liman|Fırtınadan sonra deniz süt liman oldu.|Tartışmalar bitince ofis birden süt liman kesildi.|Dün gergin olan sokaklar bugün süt limandı.
yağlı kapı|Kolay kazanç için kendine yağlı kapı arıyordu.|İhaleler bazı şirketler için yağlı kapıya dönüştü.|Partiye bir yağlı kapı bulma umuduyla yaklaşmıştı.
yılan hikayesi|Metro projesi yıllardır yılan hikayesine döndü.|Tadilat işi yine yılan hikayesi oldu.|Dosyanın yılan hikayesine dönmesinden herkes bıktı.
züğürt tesellisi|Kaybettikten sonra kupayı küçümsemesi züğürt tesellisiydi.|Bu sözler başarısızlığı örten bir züğürt tesellisinden ibaret.|Rakibin de yenilmesine sevinmek züğürt tesellisi sayılır.
dost kazığı|Ortağından yediği dost kazığı onu iflasa sürükledi.|Böyle bir dost kazığını hiç beklemiyordu.|Dost kazığı yüzünden insanlara güveni sarsıldı.
fil hafızası|Fil hafızası sayesinde yıllar önceki ayrıntıları bile hatırlıyor.|Arşivci fil hafızasıyla herkesi şaşırttı.|Onun fil hafızası hiçbir ismi unutmaz.
geyik muhabbeti|Kahvede saatlerce geyik muhabbeti yaptılar.|İşi bırakıp geyik muhabbetine dalmayın.|Yolculuk neşeli bir geyik muhabbetiyle geçti.
gönül gözü|Gönül gözü açık insan, söylenmeyeni de anlar.|Olaylara yalnız akılla değil gönül gözüyle bakıyordu.|Şair dünyayı gönül gözünden anlatmış.
göz hapsi|Polis şüpheliyi gün boyu göz hapsinde tuttu.|Yeni çalışan ilk haftasında müdürün göz hapsindeydi.|Muhabirler ünlü oyuncuyu sürekli göz hapsine aldı.
göz nuru|Bu el işi annemin yıllarca döktüğü göz nurudur.|Öğretmen göz nuru öğrencilerinin başarısıyla gurur duydu.|Sergide sanatçının göz nuru eserleri yer aldı.
hayat öpücüğü|Sağlık görevlisinin hayat öpücüğü çocuğu kurtardı.|Yeni yatırım batmak üzere olan şirkete hayat öpücüğü verdi.|Son gol takıma adeta hayat öpücüğü oldu.
kara gün|Kara gün için bir miktar para biriktiriyor.|Dostunun kara günde yanında olacağını biliyordu.|Ülke tarihinin en kara günlerinden birini yaşadı.
kıl payı|Otobüsü kıl payı kaçırdık.|Sporcu yarışı kıl payı kazandı.|Araba yayaya kıl payı çarpmadı.
kuş uçuşu|İki köyün arası kuş uçuşu beş kilometredir.|Otel, meydana kuş uçuşu çok yakın.|Kuş uçuşu mesafe kısa olsa da yol dağların çevresinden geçiyor.
ölüm kalım|Bu ameliyat onun için ölüm kalım meselesiydi.|Takım ölüm kalım maçına çıkacak.|Suya erişim bölgede ölüm kalım sorunu hâline geldi.
para babası|Kasabanın para babası bütün arsaları satın aldı.|Yeni yatırımın arkasında tanınmış bir para babası var.|Kendini para babası sanıp herkese emir veriyor.
piyasa kurdu|Deneyimli piyasa kurdu bu dalgalanmaya hazırlıklıydı.|Genç yatırımcı deneyimli bir piyasa kurdu karşısında temkinliydi.|Onun gibi bir piyasa kurdu fırsatı hemen fark eder.
saatli bomba|Büyüyen borç yükü ekonomi için saatli bomba.|Bakımsız bina mahallenin ortasında saatli bomba gibi duruyor.|Uzmanlar sorunu gecikmeli bir saatli bomba olarak tanımladı.
sıcak para|Merkez bankası sıcak para girişine karşı önlem aldı.|Ekonomi kısa vadeli sıcak paraya bağımlı hâle geldi.|Faiz artışı ülkeye yeniden sıcak para çekti.
soğuk duş|Beklenmedik yenilgi taraftarlara soğuk duş etkisi yaptı.|Olumsuz rapor yönetim için soğuk duş oldu.|Zam haberi çalışanlarda soğuk duş etkisi yarattı.
tatlı dil|Tatlı dil en gergin müşteriyi bile sakinleştirdi.|Sorunu tatlı dille çözmeyi tercih etti.|Onun tatlı dili herkesi kolayca ikna eder.
tekne kazıntısı|Ailenin tekne kazıntısı olduğu için herkes onu şımartıyordu.|Tekne kazıntısı kardeşim benden on beş yaş küçük.|Evin tekne kazıntısı bu yıl üniversiteye başladı.
yol haritası|Kurul reform için ayrıntılı bir yol haritası hazırladı.|Taraflar barış görüşmelerinin yol haritasında uzlaştı.|Rapor önümüzdeki beş yılın yol haritasını çiziyor.
beyin göçü|Düşük ücretler ülkeden beyin göçünü hızlandırdı.|Üniversiteler beyin göçünü tersine çevirmek istiyor.|Araştırma, genç bilim insanları arasındaki beyin göçünü inceliyor.
beyin fırtınası|Ekip yeni slogan için beyin fırtınası yaptı.|Beyin fırtınası oturumunda onlarca fikir çıktı.|Sorunu çözmek için kısa bir beyin fırtınası düzenledik.
cadı kazanı|Kulüp yönetimi seçim öncesi cadı kazanına döndü.|Dedikodular ofisi tam bir cadı kazanı yaptı.|Ligin alt sıralarında cadı kazanı kaynıyor.
çorap söküğü|İlk itiraftan sonra gerçekler çorap söküğü gibi geldi.|Bir dosya açılınca yolsuzluklar çorap söküğü gibi ortaya çıktı.|Sorunun çözümü başlayınca gerisi çorap söküğü gibi ilerledi.
demir perde|Demir perde yıllarca kıtayı ikiye böldü.|Ülke dış dünyaya karşı yeni bir demir perde kuruyor.|Sansür, toplumla gerçekler arasında demir perde oluşturdu.
dip dalga|Anketlerin göremediği dip dalga seçim sonucunu değiştirdi.|Toplumdaki dip dalga sessizce büyüyordu.|Yeni hareket güçlü bir dip dalganın üzerinde yükseldi.
domino etkisi|Bankanın çöküşü piyasada domino etkisi yarattı.|Bir fabrikanın kapanması bölgede domino etkisi oluşturdu.|Yanlış kararların domino etkisi bütün projeyi sarstı.
dönüm noktası|Bu buluş tıp tarihinde dönüm noktası oldu.|Final maçı kariyerinin dönüm noktasıydı.|Yeni yasa ülkenin enerji politikasında önemli bir dönüm noktasıdır.
fırsat penceresi|Müzakereler için kısa bir fırsat penceresi açıldı.|Şirket pazara girmek için fırsat penceresini kaçırdı.|Uzmanlar reform adına hâlâ bir fırsat penceresi bulunduğunu söylüyor.
gri alan|Yasa bu konuda geniş bir gri alan bırakıyor.|Etik ile çıkar çatışması arasındaki gri alan tartışıldı.|Yeni teknoloji mevcut kurallarda gri alan oluşturdu.
güven oyu|Hükümet parlamentodan güven oyu aldı.|Başbakan yarın meclisten güven oyu isteyecek.|Yönetim kurulu başkana yeniden güven oyu verdi.
ince ayar|Mühendisler sistemde son bir ince ayar yaptı.|Mesajın tonuna biraz ince ayar gerekiyor.|Politika, bölgesel farklara göre ince ayarla uygulanacak.
kalp kırıklığı|Ayrılığın kalp kırıklığını uzun süre atlatamadı.|Roman genç bir kadının kalp kırıklığını anlatıyor.|Bu sözler onda derin kalp kırıklığı yarattı.
kırılma noktası|Uzayan grev görüşmelerde kırılma noktası oldu.|Sıcaklık malzemenin kırılma noktasına yaklaştı.|Bu olay toplumun sabrında bir kırılma noktası yarattı.
kör nokta|Rapor, politikanın en önemli kör noktasını gösterdi.|Her yöneticinin fark etmediği bir kör noktası olabilir.|Tartışmada kırsal kesim yine kör nokta olarak kaldı.
köprü başı|Şirket bölge pazarında stratejik bir köprü başı elde etti.|Birlikler nehrin karşı kıyısında köprü başını korudu.|Liman, yeni ticaret ağı için köprü başı işlevi görüyor.
kukla hükümet|Muhalefet yönetimi kukla hükümet olmakla suçladı.|İşgal gücü bölgede bir kukla hükümet kurdu.|Kukla hükümet bağımsız karar alamıyordu.
kurşun asker|Yönetici çevresinde yalnızca kurşun asker istiyor.|Kurşun asker gibi verilen her emri sorgusuz uyguladı.|Parti, üyelerini kurşun askere çevirmemeli.
merdiven altı|Merdiven altı üretim halk sağlığını tehdit ediyor.|Ekipler merdiven altı atölyeleri denetledi.|Ucuz ürünün merdiven altı koşullarda yapıldığı belirlendi.
nalıncı keseri|Kaynak dağıtımında nalıncı keseri gibi hep kendine yontuyor.|Onun nalıncı keseri tutumu ortakları bezdirdi.|Karar yine nalıncı keseri misali yöneticilerin çıkarına çalıştı.
rüşvet çarkı|Soruşturma belediyedeki rüşvet çarkını ortaya çıkardı.|Rüşvet çarkının içinde çok sayıda görevli vardı.|Yeni denetim sistemi rüşvet çarkını kırmayı amaçlıyor.
sabır taşı|Yıllardır herkesin derdini dinleyen kadın sabır taşına dönmüştü.|Beni sabır taşı sanıp bütün sorunlarını anlatıyor.|Evin sabır taşı olan baba sonunda isyan etti.
sis perdesi|Açıklamalar gerçeğin önüne sis perdesi çekti.|Yönetim rakamları bir sis perdesinin arkasına sakladı.|Soruşturma olayın üzerindeki sis perdesini kaldırdı.
sürpriz yumurta|Bu transfer paketi tam bir sürpriz yumurta çıktı.|Yeni yönetmelik içinde pek çok sürpriz yumurta barındırıyor.|Kutudan nasıl bir sürpriz yumurta çıkacağını kimse bilmiyor.
şamar oğlanı|Takım her yenilgide kaleciyi şamar oğlanına çeviriyor.|Krizin şamar oğlanı olarak yine küçük esnaf seçildi.|Kimse kurumun şamar oğlanı olmak istemiyor.
şöhret basamağı|Yarışma genç oyuncu için şöhret basamağı oldu.|Bu rolü yalnızca şöhret basamağı olarak görmediğini söyledi.|Sosyal medya birçok kişi için hızlı bir şöhret basamağına dönüştü.
taht kavgası|Liderin ayrılmasından sonra partide taht kavgası başladı.|Şirketteki taht kavgası kararları geciktiriyor.|İki kardeş arasındaki taht kavgası aileyi böldü.
tezgâh altı|Yasak ürünler tezgâh altından satılıyordu.|Biletlerin tezgâh altı satışına soruşturma açıldı.|Bazı ilaçlar eczanelerde tezgâh altına düşmüş.
vitrin süsü|Kuruldaki genç üyeler yalnızca vitrin süsü olarak kullanıldı.|Bu danışma organı yetkisiz bir vitrin süsünden ibaret.|Çevre projesinin vitrin süsü olmadığı kanıtlanmalı.
zaman tüneli|Eski mahallede yürürken kendini zaman tünelinde hissetti.|Müze ziyaretçileri adeta zaman tüneline sokuyor.|Bu fotoğraf albümü beni bir zaman tünelinden geçirdi.
kartopu etkisi|Küçük zamlar zamanla kartopu etkisi yarattı.|Kampanya sosyal medyada kartopu etkisiyle büyüdü.|Biriken borçlar kartopu etkisi göstererek katlandı.
"""

_CUSTOM_PC = r"""
aslan payı|Bütçeden aslan payını eğitim aldı.|Kazancın aslan payı büyük ortağa gitti.|Pazarın aslan payını üç şirket kontrol ediyor.
ateş hattı|Ekipler ateş hattındaki sivilleri tahliye etti.|Takım son galibiyetle ateş hattından uzaklaştı.|Muhabir günlerce ateş hattında görev yaptı.
beyin takımı|Kampanyanın beyin takımı yeni stratejiyi hazırladı.|Şirketin beyin takımında deneyimli mühendisler var.|Başkan ekonomi için ayrı bir beyin takımı kurdu.
cam tavan|Kadın yöneticiler cam tavanı aşmakta hâlâ zorlanıyor.|Araştırma iş yerindeki cam tavan etkisini inceliyor.|Yeni politika terfideki cam tavan engelini kaldırmayı amaçlıyor.
can yoldaşı|Köpeği yıllardır onun can yoldaşıydı.|Bu uzun yolculukta kendine güvenilir bir can yoldaşı buldu.|Eşini yalnız hayat arkadaşı değil, can yoldaşı olarak görüyor.
çark dişi|Her çalışan büyük düzenin bir çark dişi gibi görülmemeli.|Sistemin küçük bir çark dişi olmayı reddetti.|Üretim zincirindeki tek bir çark dişi aksayınca işler durdu.
çıkış yolu|Borç krizinden çıkış yolu arıyorlar.|Müzakereler soruna barışçı bir çıkış yolu sağlayabilir.|Başka çıkış yolu kalmayınca projeyi durdurdular.
deniz kurdu|Yaşlı deniz kurdu yaklaşan fırtınayı hemen anladı.|Mürettebat deneyimli deniz kurdunun sözünü dinledi.|Otuz yıl kaptanlık yapan adam gerçek bir deniz kurduydu.
dikenli yol|Reformcular önlerinde uzun ve dikenli yol bulunduğunu biliyor.|Başarıya giden dikenli yol onu yıldırmadı.|Diplomasi bu kez oldukça dikenli yol koşullarıyla karşılaştı.
ekmek teknesi|Balıkçı teknesini tek ekmek teknesi olarak görüyordu.|Dükkân ailenin ekmek teknesiydi.|Sel, çiftçinin ekmek teknesini elinden aldı.
eşek şakası|Arkadaşına yaptığı eşek şakası yaralanmayla sonuçlandı.|Bu tehlikeli hareket eşek şakası sayılmaz.|Öğretmen eşek şakasına karışan öğrencileri uyardı.
fikir babası|Projenin fikir babası ödülü ekip adına aldı.|Bu yöntemin fikir babası genç bir araştırmacıydı.|Kampanyanın fikir babası kimliğini açıklamadı.
gönül bağı|İki şehir arasında yıllardır güçlü bir gönül bağı var.|Memleketiyle gönül bağını hiç koparmadı.|Öğretmen ile öğrencileri arasında özel bir gönül bağı kurulmuştu.
gönül yarası|Eski gönül yarası yıllar sonra yeniden sızladı.|Şarkılarında gençliğinin gönül yarasını anlatıyor.|Bu ayrılık onda derin bir gönül yarası bıraktı.
göz kararı|Baharatı göz kararı ekledi.|Usta tahtayı göz kararı iki eşit parçaya ayırdı.|Ölçü kabı olmayınca unu göz kararı koyduk.
hayat arkadaşı|Hayat arkadaşını üniversitede tanımış.|Törene hayat arkadaşıyla birlikte katıldı.|İyi bir hayat arkadaşı zor günlerde yanında olur.
hayat dersi|Bu başarısızlık ona önemli bir hayat dersi verdi.|Yolculuk hepimiz için unutulmaz bir hayat dersiydi.|Çocuklarına her zorluğun bir hayat dersi olduğunu anlatıyor.
kara liste|Şirket güvenlik ihlali yapan tedarikçileri kara listeye aldı.|Adı uluslararası kara listede yer alıyor.|Kara liste uygulamasının hukuki dayanağı tartışılıyor.
kara para|Polis kara para aklayan ağı ortaya çıkardı.|Bankalar kara para hareketlerini bildirmek zorunda.|Soruşturma milyonlarca liralık kara para trafiğini inceliyor.
kara mizah|Film savaşın acılarını kara mizahla anlatıyor.|Yazarın kara mizah anlayışı herkese uygun değil.|Bu sahne trajedi ile kara mizah arasında duruyor.
kara propaganda|Seçim döneminde yoğun kara propaganda yürütüldü.|Sahte hesapların kara propaganda ağına bağlı olduğu belirlendi.|Gazete suçlamaları kara propaganda olarak nitelendirdi.
keçi inadı|Keçi inadı yüzünden makul öneriyi kabul etmedi.|Onun keçi inadı bütün görüşmeyi kilitledi.|Biraz keçi inadından vazgeçse sorun çözülecek.
kilit nokta|Finansman projenin kilit noktasıdır.|Anlaşmanın kilit noktasında taraflar uzlaşamadı.|Uzman konuşmasında üç kilit noktayı vurguladı.
köşe taşı|Özgür basın demokrasinin köşe taşıdır.|Bu keşif modern fizik için bir köşe taşı oldu.|Güven, sağlıklı ilişkinin temel köşe taşı sayılır.
kuyruk acısı|Eski yenilgiden kuyruk acısı kaldığı belliydi.|Bize yönelik öfkesinin nedeni kuyruk acısı olabilir.|Kuyruk acısıyla hareket edip tarafsızlığını yitirdi.
omuz yükü|Ailenin bütün omuz yükü en büyük çocuğa kaldı.|Borçların omuz yükü onu giderek yoruyordu.|Sorumluluğun omuz yükünü ekibiyle paylaşmayı öğrendi.
puslu hava|Seçim öncesi siyasette puslu hava hâkimdi.|Piyasadaki puslu hava yatırımcıyı beklemeye yöneltti.|Açıklamalar belirsizliği gidermek yerine puslu hava yarattı.
ruh ikizi|Onu ilk günden ruh ikizi olarak gördü.|İki arkadaş birbirinin ruh ikizi gibiydi.|Yıllarca aradığı ruh ikizini bulduğuna inanıyor.
sahne arkası|Oyuncular sahne arkasında son hazırlıklarını yaptı.|Belgesel festivalin sahne arkasını gösteriyor.|Kararın sahne arkasında yoğun bir pazarlık vardı.
sinir harbi|Uzayan görüşmeler taraflar arasında sinir harbine dönüştü.|Kaleci penaltı öncesi rakibiyle sinir harbi yaşadı.|Bu bekleyiş aile için tam bir sinir harbiydi.
umut kapısı|Yeni tedavi hastalar için umut kapısı oldu.|Kooperatif işsiz gençlere bir umut kapısı açtı.|Mahalleli merkezi son umut kapısı olarak görüyor.
vicdan azabı|Yalan söylediği için vicdan azabı çekiyordu.|Kazadan sonra duyduğu vicdan azabı dinmedi.|Vicdan azabıyla gidip gerçeği polise anlattı.
zehir zemberek|Gazete karara karşı zehir zemberek bir yazı yayımladı.|Muhalefet sözcüsü zehir zemberek açıklamalarda bulundu.|Eleştirmenin zehir zemberek sözleri salonda sessizlik yarattı.
altın çağ|Kent ticaretin altın çağını bu dönemde yaşadı.|Bilim tarihinin altın çağı olarak anılan yılları incelediler.|Takım eski altın çağına dönmek istiyor.
boş laf|Boş laf yerine uygulanabilir öneri bekliyoruz.|Toplantıda saatlerce boş laf dinledik.|Verdiği sözlerin boş laf olduğu kısa sürede anlaşıldı.
çamur atma|Kanıtsız iddiaları açık bir çamur atma girişimiydi.|Seçim kampanyası karşılıklı çamur atmaya dönüştü.|Rakibine çamur atma siyaseti seçmene güven vermedi.
çifte standart|Aynı olayda farklı karar verilmesi çifte standarttır.|Kurumun çifte standart uyguladığı öne sürüldü.|Çifte standart eleştirilerine yönetim yanıt vermedi.
el kitabı|Yeni çalışanlara güvenlik el kitabı dağıtıldı.|Bu eser araştırmacılar için temel bir el kitabıdır.|Seyahat el kitabı bölgedeki bütün rotaları anlatıyor.
göz dağı|Polis göstericilere göz dağı vermek için barikat kurdu.|Bu açıklamanın amacı rakiplere göz dağı vermekti.|Şirket dava tehdidiyle çalışanlara göz dağı verdi.
kara leke|Bu olay kurumun tarihinde kara leke olarak kaldı.|Yolsuzluk iddiası kariyerine kara leke sürdü.|Savaş, insanlık tarihinin büyük kara lekelerinden biridir.
kara tablo|Rapor ekonomideki kara tabloyu açıkça gösterdi.|Uzmanlar çevre kirliliğine ilişkin kara tablo çizdi.|Yeni veriler beklenenden ağır bir kara tablo ortaya koyuyor.
kırık kalp|Kırık kalp zamanla iyileşir.|Şarkı, kırık kalpli bir gencin hikâyesini anlatıyor.|Kırık kalp bazen insanı herkesten uzaklaştırır.
kilit isim|Kilit isim bugün müzakereler için başkente geldi.|Kilit isim sakatlığı nedeniyle bu maçta oynayamayacak.|Soruşturmada kilit isim olarak görülen tanık konuştu.
kör inanç|Kör inanç eleştirel düşüncenin önünü kapatır.|Bilimsel kanıt yerine kör inanç tercih edildi.|Kör inanç yüzünden açık gerçekleri reddediyordu.
kuru gürültü|Tehditlerinin kuru gürültü olduğu anlaşıldı.|Bu gösteri kuru gürültüden başka sonuç üretmedi.|Kuru gürültü yaparak bizi korkutamazlar.
kuru kalabalık|Mitingde sayı çoktu ama çoğu kuru kalabalıktı.|Projeye katkı vermeyen kuru kalabalık ekibi yavaşlattı.|Yönetici nitelikli ekip yerine kuru kalabalık toplamış.
medya maymunu|Her programa çıkan oyuncuya medya maymunu denmesini haksız buldu.|Dikkat çekmek uğruna medya maymununa dönüştü.|Siyasetçinin medya maymunu tavırları seçmeni yordu.
namus borcu|Bu emaneti korumayı namus borcu sayıyordu.|Gerçeği açıklamak bizim için namus borcudur.|Dostunun ailesine yardım etmeyi namus borcu bildi.
nazar boncuğu|Bebeğin beşiğine nazar boncuğu taktılar.|Dükkânın girişinde büyük bir nazar boncuğu asılıydı.|Nazar boncuğunun kötü bakıştan koruduğuna inanıyor.
ölüm sessizliği|Haber duyulunca salona ölüm sessizliği çöktü.|Sokaklarda ürkütücü bir ölüm sessizliği vardı.|Patlamadan hemen önce çevreyi ölüm sessizliği kapladı.
para musluğu|Yeni sözleşme kulübe para musluğu açtı.|Belediyenin para musluğu kesilince proje durdu.|Bazı şirketler kamu ihalelerini para musluğu gibi görüyor.
reklam yüzü|Ünlü sporcu markanın yeni reklam yüzü oldu.|Şirket genç bir oyuncuyu reklam yüzü seçti.|Reklam yüzünün sözleşmesi sezon sonunda bitecek.
rüya takımı|Turnuva için kurulan rüya takımı ilk maçını kazandı.|Projede alanın uzmanlarından bir rüya takımı çalışıyor.|Taraftarlar yeni kadroyu rüya takımı olarak görüyor.
sabun köpüğü|İlk haftadaki başarının sabun köpüğü olduğu anlaşıldı.|Sosyal medyadaki ünü sabun köpüğü gibi söndü.|Bu geçici ilgi bir sabun köpüğünden ibaret kalabilir.
sahte cennet|Tatil köyünün sahte cennet görüntüsü kısa sürede dağıldı.|Reklamların sunduğu sahte cennetin arkasında ağır çalışma koşulları vardı.|Dışarıdan parlak görünen düzen aslında sahte cennetti.
ses duvarı|Uçak denemede ses duvarını aştı.|Pilot ses duvarına yaklaşırken sarsıntı hissetti.|Ses duvarı havacılık tarihinin önemli eşiklerinden biriydi.
sevgi seli|Sanatçı sahnede büyük bir sevgi seliyle karşılandı.|Taraftarların sevgi seli oyuncuyu duygulandırdı.|Kampanya kısa sürede ülke çapında sevgi seline dönüştü.
soğuk savaş|İki ülke arasında yeni bir soğuk savaş başladı.|Soğuk savaş dönemi dünya siyasetini biçimlendirdi.|Şirket içindeki soğuk savaş çalışanları ikiye böldü.
söz düellosu|İki aday canlı yayında söz düellosuna girdi.|Mecliste iktidar ile muhalefet arasında söz düellosu yaşandı.|Sert söz düellosu toplantının önüne geçti.
şans kapısı|Bu burs onun için yeni bir şans kapısı açtı.|Genç oyuncu seçmeleri şans kapısı olarak görüyor.|Program işsizlere önemli bir şans kapısı sunuyor.
taş yürek|Onun taş yürek tavrı bu manzara karşısında bile değişmedi.|Böyle taş yürekli davranmasına kimse anlam veremedi.|Hikâyedeki taş yürekli kral sonunda pişman oldu.
umut ışığı|Yeni bulgu hastalar için umut ışığı oldu.|Karanlık dönemde küçük bir umut ışığı belirdi.|Ateşkes haberi barış için umut ışığı yaktı.
vergi cenneti|Şirket kazancını bir vergi cennetinde tuttu.|Ülke yabancı yatırımcılar için vergi cennetine dönüştü.|Vergi cenneti uygulamaları küresel eşitsizliği artırıyor.
vicdan muhasebesi|Karardan sonra uzun bir vicdan muhasebesi yaptı.|Toplum geçmişle ilgili vicdan muhasebesine ihtiyaç duyuyor.|Gece boyunca kendi içinde vicdan muhasebesi yaşadı.
yasak aşk|Roman iki genç arasındaki yasak aşkı anlatıyor.|Yasak aşk yıllarca herkesten saklandı.|Dizinin merkezinde ailelerin karşı çıktığı bir yasak aşk var.
yıldız oyuncu|Takımın yıldız oyuncusu finalde sakatlandı.|Kulüp yıldız oyuncuyla yeni sözleşme imzaladı.|Genç forvet kısa sürede yıldız oyuncuya dönüştü.
zaman kaybı|Bu tartışma herkes için zaman kaybı oldu.|Sonuç vermeyen toplantıları zaman kaybı sayıyor.|Aynı işi iki kez yapmak büyük zaman kaybıdır.
altın fırsat|Yeni pazar şirket için altın fırsat sunuyor.|Bu burs eğitimine devam etmesi için altın fırsattı.|Takım öne geçmek için altın fırsatı kaçırdı.
acı gerçek|Acı gerçekle yüzleşmekten kaçıyordu.|Raporda acı gerçek açıkça ortaya kondu.|Acı gerçek, planın sürdürülemez olmasıydı.
boş vaat|Seçmen artık boş vaat duymak istemiyor.|Verdiği sözler yine boş vaat olarak kaldı.|Kampanyadaki boş vaat listesi giderek uzuyor.
çürük elma|Bir çürük elma bütün ekibin itibarını bozdu.|Yönetim kurum içindeki çürük elmaları ayıklayacağını söyledi.|Her grupta bir çürük elma çıkabilir.
demir yumruk|Diktatör ülkeyi demir yumrukla yönetti.|Demir yumruk muhalifleri susturmak için kullanıldı.|Sorunları demir yumruk politikasıyla çözmeye çalıştı.
derin devlet|Soruşturma derin devlet iddialarını yeniden gündeme getirdi.|Gazeteci derin devlet ağını araştırıyordu.|Derin devlet tartışması yıllardır sonuçlanmadı.
dert küpü|Komşum tam bir dert küpü; her gün başka sorun anlatıyor.|Çocuk dert küpüne dönünce öğretmeni onunla konuştu.|Onu dert küpü hâlinde görmek ailesini üzdü.
gizli el|Piyasadaki hareketlerin ardında gizli el arandı.|Olayları yönlendiren bir gizli el bulunduğuna inanıyor.|Rapor karar sürecindeki gizli eli ortaya çıkardı.
güç zehirlenmesi|Yönetici kısa sürede güç zehirlenmesine kapıldı.|Güç zehirlenmesi eleştiriye tahammülünü yok etti.|Uzun iktidarın güç zehirlenmesi yaratabileceği uyarısı yapıldı.
hava korsanı|Hava korsanı uçağın rotasını değiştirmesini istedi.|Polis hava korsanını inişten sonra yakaladı.|Yolcular hava korsanına karşı birlikte hareket etti.
hız tutkusu|Hız tutkusu yüzünden sık sık ceza alıyor.|Belgesel yarışçıların hız tutkusunu anlatıyor.|Gençlerin hız tutkusu güvenli sürüş eğitiminde ele alındı.
insan sarrafı|Yılların yöneticisi iyi bir insan sarrafı olmuştu.|İnsan sarrafı olduğunu söyleyen adam bu kez yanıldı.|Deneyimli öğretmen tam bir insan sarrafıydı.
kan gölü|Saldırı meydanı kan gölüne çevirdi.|Tanıklar sokağın kan gölü olduğunu anlattı.|Çatışma bitmezse bölge kan gölüne dönebilir.
korku tüneli|Lunaparktaki korku tüneli çocukları ürküttü.|Sınav süreci onun için korku tüneline dönüştü.|Film izleyiciyi uzun bir korku tünelinden geçiriyor.
kriz masası|Valilik sel için kriz masası kurdu.|Kriz masası gelişmeleri saat saat izliyor.|Bakanlar acil kriz masasında bir araya geldi.
linç kültürü|Sosyal medyadaki linç kültürü farklı görüşleri susturuyor.|Linç kültürü yüzünden insanlar hata yapmaktan korkuyor.|Panelde dijital linç kültürü tartışıldı.
makam sarhoşluğu|Göreve gelir gelmez makam sarhoşluğuna kapıldı.|Makam sarhoşluğu eski dostlarını unutmasına yol açtı.|Yöneticileri makam sarhoşluğuna karşı uyardı.
para tuzağı|Sözde kampanya tüketiciler için para tuzağı çıktı.|Bu oyun içi satın almalar tam bir para tuzağıdır.|Turistler pahalı dükkânı para tuzağı olarak nitelendirdi.
rant kapısı|İmar değişiklikleri bazıları için rant kapısı oldu.|Kamu arazileri yeni bir rant kapısına çevrildi.|Muhalefet projeyi rant kapısı olmakla eleştirdi.
sevgi pıtırcığı|Evin sevgi pıtırcığı herkesi gülümsetiyordu.|Küçük oyuncu dizinin sevgi pıtırcığı oldu.|Arkadaşları ona sevgi pıtırcığı diye sesleniyor.
suç makinesi|Polis yıllardır aranan suç makinesini yakaladı.|Genç adam kısa sürede suç makinesine dönüştü.|Basın zanlıyı suç makinesi olarak tanıttı.
"""

_CUSTOM_C = r"""
araştırma projesi|Yeni araştırma projesi gelecek ay başlayacak.|Araştırma projesi için üç üniversite birlikte çalışıyor.|Kurul araştırma projesinin bütçesini onayladı.
sınıf öğretmeni|Sınıf öğretmeni velilerle toplantı yaptı.|Öğrenciler sınıf öğretmeniyle müzeyi gezdi.|Yeni sınıf öğretmeni pazartesi göreve başlayacak.
masa lambası|Masa lambası çalışma alanını yeterince aydınlatıyor.|Eski masa lambasını tamir ettirdi.|Yeni masa lambası ayarlanabilir bir kola sahip.
duvar saati|Duvar saati beş dakika geri kalmış.|Salondaki duvar saatini değiştirdik.|Yeni duvar saati sessiz çalışıyor.
kitap kapağı|Kitap kapağı genç bir tasarımcı tarafından hazırlandı.|Yırtılan kitap kapağını dikkatlice onardı.|Yeni baskının kitap kapağı mavi olacak.
havaalanı terminali|Yeni havaalanı terminali bugün açıldı.|Yolcular havaalanı terminalinde uzun süre bekledi.|Havaalanı terminali şehir merkezine trenle bağlandı.
proje yönetimi|Ekip proje yönetimi için yeni yazılım kullanıyor.|Proje yönetimi deneyimi bu görevde çok önemli.|Kurum proje yönetimi sürecini yeniden düzenledi.
kalite kontrolü|Ürünler sevkiyattan önce kalite kontrolünden geçiyor.|Kalite kontrolü sırasında iki hata bulundu.|Fabrika kalite kontrolü ekibini genişletti.
satış raporu|Aylık satış raporu yönetime sunuldu.|Satış raporu gelirlerdeki düşüşü gösteriyor.|Müdür güncel satış raporunu ayrıntılı inceledi.
üretim hattı|Yeni üretim hattı kapasiteyi iki kat artırdı.|Arıza yüzünden üretim hattı durdu.|Mühendisler üretim hattını yeniden düzenledi.
enerji tüketimi|Binanın enerji tüketimi geçen yıl azaldı.|Yeni sistem enerji tüketimini düzenli ölçüyor.|Raporda hanelerin enerji tüketimi karşılaştırıldı.
su deposu|Köyün su deposu tamamen doldu.|Belediye yeni bir su deposu yaptıracak.|Ekipler su deposunu temizledi.
rüzgâr türbini|Rüzgâr türbini kıyıdaki tepeye kuruldu.|Yeni rüzgâr türbini binlerce eve elektrik sağlıyor.|Mühendisler rüzgâr türbininin bakımını tamamladı.
atık yönetimi|Belediye atık yönetimi planını yeniledi.|Etkili atık yönetimi çevre kirliliğini azaltır.|Toplantıda atık yönetimi sorunları ele alındı.
çevre politikası|Şirket yeni çevre politikasını yayımladı.|Çevre politikası emisyonların azaltılmasını hedefliyor.|Uzmanlar ülkenin çevre politikasını değerlendirdi.
öğrenci belgesi|Başvuru için güncel öğrenci belgesi gerekiyor.|Öğrenci belgesini internetten indirdi.|Görevli öğrenci belgesinin aslını istedi.
öğretmen odası|Öğretmen odası ikinci kattadır.|Toplantı öğretmen odasında yapılacak.|Yeni öğretmen odası daha geniş ve aydınlık.
üniversite kampüsü|Üniversite kampüsü hafta sonu ziyarete açık.|Öğrenciler üniversite kampüsünde konser düzenledi.|Yeni üniversite kampüsü metro hattına yakın.
laboratuvar cihazı|Yeni laboratuvar cihazı hassas ölçüm yapabiliyor.|Teknisyen laboratuvar cihazını kalibre etti.|Arızalı laboratuvar cihazı onarıma gönderildi.
araştırma merkezi|Araştırma merkezi yeni binasına taşındı.|Üniversite bir yapay zekâ araştırma merkezi kurdu.|Araştırma merkezinde yüz bilim insanı çalışıyor.
bilim kurulu|Bilim kurulu bugün yeni tavsiyeler açıkladı.|Bakanlık bağımsız bir bilim kurulu oluşturdu.|Bilim kurulunun raporu kamuoyuyla paylaşıldı.
haber ajansı|Haber ajansı gelişmeyi son dakika olarak duyurdu.|Muhabir uluslararası bir haber ajansında çalışıyor.|Haber ajansının bölge ofisi yeniden açıldı.
gazete ilanı|İş için gazete ilanı verdiler.|Gazete ilanı beklenenden çok başvuru getirdi.|Kayıp eşya için küçük bir gazete ilanı yayımlandı.
radyo programı|Yeni radyo programı her cuma yayımlanacak.|Radyo programı genç müzisyenleri konuk ediyor.|Sunucu radyo programının içeriğini yeniledi.
tatil köyü|Tatil köyü yaz sezonuna hazırlanıyor.|Aile deniz kıyısındaki tatil köyünde kaldı.|Yeni tatil köyü beş yüz yatak kapasitesine sahip.
pasaport kontrolü|Yolcular pasaport kontrolünde sıraya girdi.|Pasaport kontrolü beklenenden hızlı tamamlandı.|Görevli pasaport kontrolü sırasında ek belge istedi.
gümrük kapısı|Gümrük kapısı gece yarısına kadar açık kalacak.|Tırlar gümrük kapısında uzun kuyruk oluşturdu.|Yeni gümrük kapısı ticareti hızlandırdı.
şehir haritası|Turist şehir haritasını dikkatle inceledi.|Otel resepsiyonu ücretsiz şehir haritası dağıtıyor.|Yeni şehir haritası bisiklet yollarını da gösteriyor.
kapı kilidi|Kapı kilidi içeriden açılmıyordu.|Çilingir eski kapı kilidini değiştirdi.|Güvenli kapı kilidi hırsızlık riskini azaltır.
pencere camı|Fırtınada pencere camı kırıldı.|Usta çatlayan pencere camını yeniledi.|Kalın pencere camı dışarıdaki sesi azaltıyor.
mutfak dolabı|Mutfak dolabı duvara sağlam biçimde monte edildi.|Tabakları mutfak dolabına yerleştirdi.|Yeni mutfak dolabı daha fazla saklama alanı sunuyor.
banyo aynası|Banyo aynası buhar yüzünden görünmüyordu.|Yeni banyo aynasını duvara astılar.|Banyo aynasının kenarında küçük bir çatlak var.
ekmek bıçağı|Ekmek bıçağı çekmecenin içindeydi.|Keskin ekmek bıçağı somunu kolayca dilimledi.|Yeni ekmek bıçağını kullanmadan önce yıkadı.
market arabası|Market arabası ürünlerle tamamen doldu.|Çocuk market arabasını annesine doğru itti.|Boş market arabasını girişe bıraktı.
maaş bordrosu|Maaş bordrosu çalışanlara elektronik olarak gönderildi.|Muhasebe maaş bordrosundaki hatayı düzeltti.|Çalışan kredi başvurusuna maaş bordrosunu ekledi.
"""


def records() -> list[dict[str, str]]:
    out = []
    for lineno, line in enumerate(_DATA.strip().splitlines(), 1):
        parts = [part.strip() for part in line.split("|")]
        if len(parts) != 4:
            raise ValueError(f"Bad data row {lineno}: {line!r}")
        comp_class, expression, meaning, kind = parts
        out.append(
            {
                "comp_class_provisional": comp_class,
                "canonical_form": expression,
                "meaning_tr": meaning,
                "semantic_kind": kind,
            }
        )
    counts = Counter(row["comp_class_provisional"] for row in out)
    assert counts == Counter({"I": 103, "PC": 88, "C": 89}), counts
    assert len({row["canonical_form"].casefold() for row in out}) == 280
    assert all(len(row["canonical_form"].split()) == 2 for row in out)
    return out


def custom_contexts() -> dict[str, list[str]]:
    contexts: dict[str, list[str]] = {}
    for block in (_CUSTOM_I, _CUSTOM_PC, _CUSTOM_C):
        for lineno, line in enumerate(block.strip().splitlines(), 1):
            parts = [part.strip() for part in line.split("|")]
            if len(parts) != 4:
                raise ValueError(f"Bad custom-context row {lineno}: {line!r}")
            expression, *sentences = parts
            if expression in contexts:
                raise ValueError(f"Duplicate custom contexts: {expression}")
            contexts[expression] = sentences
    required = {
        row["canonical_form"]
        for row in records()
        if row["comp_class_provisional"] in {"I", "PC"}
    }
    valid = {row["canonical_form"] for row in records()}
    assert required <= set(contexts) <= valid, (
        f"missing={sorted(required - set(contexts))}; "
        f"extra={sorted(set(contexts) - valid)}"
    )
    return contexts


def ensure_tatoeba() -> None:
    if TATOEBA_CACHE.exists() and TATOEBA_CACHE.stat().st_size > 1_000_000:
        return
    urllib.request.urlretrieve(TATOEBA_URL, TATOEBA_CACHE)


def target_pattern(expression: str) -> re.Pattern[str]:
    first, second = expression.split()
    # The first component normally stays fixed; the Turkish head (second
    # component) may carry case, number, or possessive suffixes.
    return re.compile(
        rf"(?<!\w){re.escape(first)}\s+{re.escape(second)}[\w’']*(?!\w)",
        flags=re.IGNORECASE,
    )


def tatoeba_examples(rows: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    ensure_tatoeba()
    patterns = {row["canonical_form"]: target_pattern(row["canonical_form"]) for row in rows}
    first_index: dict[str, list[str]] = defaultdict(list)
    for expression in patterns:
        first_index[expression.split()[0].casefold()].append(expression)

    found: dict[str, list[dict[str, str]]] = defaultdict(list)
    with bz2.open(TATOEBA_CACHE, "rt", encoding="utf-8") as fh:
        for raw in fh:
            fields = raw.rstrip("\n").split("\t")
            if len(fields) < 4:
                continue
            sentence_id, lang, sentence, author = fields[:4]
            if lang != "tur" or not 5 <= len(sentence.split()) <= 32:
                continue
            first_words = {re.sub(r"^\W+|\W+$", "", w).casefold() for w in sentence.split()}
            for first in first_words & first_index.keys():
                for expression in first_index[first]:
                    if len(found[expression]) >= 10:
                        continue
                    match = patterns[expression].search(sentence)
                    if match and sentence not in REJECTED_TATOEBA_SENTENCES:
                        found[expression].append(
                            {
                                "sentence": sentence,
                                "target_surface": match.group(0),
                                "origin": "internet_open_license",
                                "source_name": "Tatoeba Turkish sentences",
                                "source_url": f"https://tatoeba.org/en/sentences/show/{sentence_id}",
                                "source_author": author,
                                "source_license": TATOEBA_LICENSE,
                                "license_review_status": "verified_open_license",
                            }
                        )
    return found


def tdk_payloads(rows: list[dict[str, str]]) -> dict[str, object]:
    payloads: dict[str, object] = {}
    if TDK_CACHE.exists():
        payloads = json.loads(TDK_CACHE.read_text(encoding="utf-8"))
    if os.environ.get("FETCH_TDK_EXAMPLES") != "1":
        return payloads

    session = requests.Session()
    session.headers.update(
        {"User-Agent": "Mozilla/5.0", "Referer": "https://sozluk.gov.tr/"}
    )
    pending = [row["canonical_form"] for row in rows if row["canonical_form"] not in payloads]
    for index, expression in enumerate(pending, 1):
        try:
            response = session.get(
                "https://sozluk.gov.tr/gts", params={"ara": expression}, timeout=8
            )
            response.raise_for_status()
            payloads[expression] = response.json()
        except Exception as exc:  # preserve the failed lookup in the snapshot
            payloads[expression] = {"error": f"{type(exc).__name__}: {exc}"}
        if index % 20 == 0:
            TDK_CACHE.write_text(
                json.dumps(payloads, ensure_ascii=False), encoding="utf-8"
            )
        time.sleep(0.08)
    TDK_CACHE.write_text(json.dumps(payloads, ensure_ascii=False), encoding="utf-8")
    return payloads


def _definition_similarity(left: str, right: str) -> float:
    def normalize(value: str) -> str:
        return " ".join(re.findall(r"\w+", value.casefold(), flags=re.UNICODE))

    a, b = normalize(left), normalize(right)
    if not a or not b:
        return 0.0
    a_words, b_words = set(a.split()), set(b.split())
    jaccard = len(a_words & b_words) / len(a_words | b_words)
    return 0.65 * SequenceMatcher(None, a, b).ratio() + 0.35 * jaccard


def tdk_examples(rows: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    payloads = tdk_payloads(rows)
    found: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        expression = row["canonical_form"]
        payload = payloads.get(expression)
        if not isinstance(payload, list):
            continue
        senses: list[tuple[float, dict]] = []
        for entry in payload:
            if str(entry.get("madde", "")).casefold() != expression.casefold():
                continue
            for sense in entry.get("anlamlarListe") or []:
                score = _definition_similarity(row["meaning_tr"], str(sense.get("anlam", "")))
                senses.append((score, sense))
        if not senses:
            continue
        best = max(score for score, _ in senses)
        for score, sense in sorted(senses, key=lambda item: item[0], reverse=True):
            if score < 0.18 or score < best - 0.06:
                continue
            for example in sense.get("orneklerListe") or []:
                sentence = str(example.get("ornek", "")).strip()
                match = target_pattern(expression).search(sentence)
                if not match:
                    continue
                authors = example.get("yazar") or []
                author = authors[0].get("tam_adi", "") if authors else ""
                found[expression].append(
                    {
                        "sentence": sentence,
                        "target_surface": match.group(0),
                        "origin": "internet_dictionary_example",
                        "source_name": "Türk Dil Kurumu Güncel Türkçe Sözlük",
                        "source_url": (
                            "https://sozluk.gov.tr/gts?ara=" + urllib.parse.quote(expression)
                        ),
                        "source_author": author,
                        "source_license": "TDK copyright/reuse status not cleared",
                        "license_review_status": "license_review_required",
                        "sense_review_status": "automatic_definition_match_needs_native_review",
                    }
                )
    return found


def authored_examples(row: dict[str, str]) -> list[dict[str, str]]:
    expression = row["canonical_form"]
    cap = expression[0].upper() + expression[1:]
    kind = row["semantic_kind"]
    custom = custom_contexts().get(expression)
    if custom:
        sentences = custom
    elif kind in {"person", "person_or_issue", "person_or_thing", "person_or_org"}:
        sentences = [
            f"Çevresindekiler onu gerçek bir {expression} olarak görüyordu.",
            f"Toplantıda yine bir {expression} bütün dikkatleri üzerine çekti.",
            f"Herkes onun tam bir {expression} olduğunu düşünüyordu.",
        ]
    elif kind in {"place", "situation"}:
        sentences = [
            f"Bölge kısa sürede tam bir {expression} hâline geldi.",
            f"İnsanlar {expression} içinde kalmaktan giderek daha fazla kaygı duyuyordu.",
            f"Uzun görüşmelerin ardından {expression} görünümü nihayet değişti.",
        ]
    elif kind in {"organization", "person_or_org", "system"}:
        sentences = [
            f"Eleştirmenler yapının giderek bir {expression} hâline geldiğini söyledi.",
            f"Yeni rapor söz konusu {expression} hakkında önemli bulgular içeriyordu.",
            f"Yönetim bu {expression} yapısını bağımsız incelemeye aldı.",
        ]
    elif kind == "support":
        sentences = [
            f"Beklenmedik destek onun için gerçek bir {expression} oldu.",
            f"Yeni proje kuruma önemli bir {expression} sundu.",
            f"Zor günlerde bu imkânı bir {expression} olarak gördüler.",
        ]
    elif kind == "obstacle":
        sentences = [
            f"Bu yükümlülük projenin önünde ciddi bir {expression} oldu.",
            f"Ekip, {expression} ortadan kalkınca daha hızlı ilerledi.",
            f"Kimse yeni bir {expression} ile uğraşmak istemiyordu.",
        ]
    elif kind in {"document", "thing"}:
        sentences = [
            f"Hazırlanan {expression} toplantıda ayrıntılı biçimde incelendi.",
            f"Yeni {expression} herkesin kullanımına sunuldu.",
            f"Uzmanlar {expression} üzerinde son kontrolleri yaptı.",
        ]
    elif kind in {"event", "process"}:
        sentences = [
            f"Uzmanlar {expression} sürecini dikkatle izledi.",
            f"{cap}, toplantının en çok tartışılan konusu oldu.",
            f"Raporda {expression} konusunda yeni bulgular paylaşıldı.",
        ]
    elif kind in {"emotion"}:
        sentences = [
            f"Yaşadığı {expression} uzun süre yüzünden okunuyordu.",
            f"Bu haber onda derin bir {expression} yarattı.",
            f"Zaman geçse de {expression} bütünüyle dinmedi.",
        ]
    else:
        sentences = [
            f"Bu gelişme kamuoyunda bir {expression} olarak değerlendirildi.",
            f"Toplantıda {expression} hakkında ayrıntılı bir tartışma yapıldı.",
            f"Uzmanlar yeni {expression} örneğini raporlarında ele aldı.",
        ]
    return [
        {
            "sentence": sentence,
            "target_surface": target_pattern(expression).search(sentence).group(0),
            "origin": "authored_for_dataset",
            "source_name": "Dataset authors",
            "source_url": "",
            "source_author": "",
            "source_license": "Original text; dataset license not yet assigned",
            "license_review_status": "not_external_original_text",
        }
        for sentence in sentences
    ]


def choose_examples(
    row: dict[str, str],
    candidates: dict[str, list[dict[str, str]]],
    dictionary_candidates: dict[str, list[dict[str, str]]],
) -> list[dict[str, str]]:
    # Compositional compounds are sense-stable, so exact corpus occurrences
    # are safe to use automatically.  For I/PC items, keep at most one open
    # corpus example and fill the rest with controlled authored contexts; the
    # exact occurrence is marked for later native-speaker sense review.
    expression = row["canonical_form"]
    available = candidates.get(expression, [])
    if row["comp_class_provisional"] == "C":
        limit = 3
    elif expression in REVIEWED_TATOEBA_FIRST:
        limit = 1
    else:
        limit = 0
    chosen = available[:limit]
    for item in chosen:
        item["sense_review_status"] = (
            "exact_match_low_ambiguity" if row["comp_class_provisional"] == "C"
            else "manually_reviewed_target_sense"
        )
    for item in dictionary_candidates.get(expression, []):
        if len(chosen) == 3:
            break
        if item["sentence"] not in {existing["sentence"] for existing in chosen}:
            chosen.append(item)
    for item in authored_examples(row):
        if len(chosen) == 3:
            break
        item["sense_review_status"] = "authored_meaning_checked"
        chosen.append(item)
    return chosen


def build() -> None:
    rows = records()
    candidates = tatoeba_examples(rows)
    dictionary_candidates = tdk_examples(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "mwe_id",
        "language",
        "canonical_form",
        "token_count",
        "mwe_type",
        "modifier",
        "head",
        "comp_class_provisional",
        "comp_score_gold_0_5",
        "annotation_status",
        "meaning_tr",
        "meaning_origin",
        "meaning_source_name",
        "meaning_source_url",
        "meaning_reuse_status",
        "meaning_license_review_status",
        "neutral_sentence",
        "neutral_sentence_review_status",
    ]
    for n in range(1, 4):
        fields.extend(
            [
                f"example_{n}",
                f"example_{n}_target_surface",
                f"example_{n}_origin",
                f"example_{n}_source_name",
                f"example_{n}_source_url",
                f"example_{n}_source_author",
                f"example_{n}_source_license",
                f"example_{n}_license_review_status",
                f"example_{n}_sense_review_status",
            ]
        )
    fields.extend(["curation_notes", "accessed_at"])

    with OUT.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        for index, row in enumerate(rows, 1):
            expression = row["canonical_form"]
            modifier, head = expression.split()
            q = urllib.parse.quote(expression)
            output = {
                "mwe_id": f"TR-NC-{index:03d}",
                "language": "TR",
                "canonical_form": expression,
                "token_count": 2,
                "mwe_type": "nominal_multiword_expression",
                "modifier": modifier,
                "head": head,
                "comp_class_provisional": row["comp_class_provisional"],
                "comp_score_gold_0_5": "",
                "annotation_status": "provisional_curation_requires_human_rating",
                "meaning_tr": row["meaning_tr"],
                "meaning_origin": "curator_paraphrase_after_lexicographic_check",
                "meaning_source_name": "Türk Dil Kurumu Sözlükleri",
                "meaning_source_url": f"https://sozluk.gov.tr/?ara={q}",
                "meaning_reuse_status": "paraphrased_not_copied",
                "meaning_license_review_status": "source_link_recorded_review_if_publishing",
                "neutral_sentence": NEUTRAL_OVERRIDES.get(
                    expression, f"Bu bir {expression}."
                ),
                "neutral_sentence_review_status": (
                    "manual_turkish_structure_override"
                    if expression in NEUTRAL_OVERRIDES
                    else "two_word_nominal_template"
                ),
                "curation_notes": "Two-token candidate; class is provisional, not a gold human label.",
                "accessed_at": "2026-06-23",
            }
            for n, item in enumerate(
                choose_examples(row, candidates, dictionary_candidates), 1
            ):
                for key in (
                    "sentence",
                    "target_surface",
                    "origin",
                    "source_name",
                    "source_url",
                    "source_author",
                    "source_license",
                    "license_review_status",
                    "sense_review_status",
                ):
                    csv_key = f"example_{n}" if key == "sentence" else f"example_{n}_{key}"
                    output[csv_key] = item[key]
            writer.writerow(output)
    print(f"Wrote {len(rows)} records to {OUT}")


if __name__ == "__main__":
    build()
