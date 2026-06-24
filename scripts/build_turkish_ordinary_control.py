#!/usr/bin/env python3
"""Build the 64-item Turkish counterpart of article Experiment 4.

The design mirrors ``experiments/perturbation_control/control_examples.csv``:
16 idiomatic NCs, 16 compositional NCs, 16 ordinary single words and 16
ordinary two-word phrases.  These are curated candidates, not released gold:
frequency matching and final grammar/semantic review remain explicit gates.
"""
from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "data" / "ncimp" / "TR" / "turkish_ncimp_inventory.csv"
OUT_CSV = ROOT / "data" / "ncimp" / "TR" / "turkish_ordinary_control.csv"
PUBLIC_CSV = ROOT / "studio" / "public" / "controls" / "turkish_ordinary_control.csv"
PUBLIC_JSON = ROOT / "studio" / "public" / "controls" / "turkish_ordinary_control.json"

# group, linked MWE id, target, sentence, holistic synonym, component,
# word-by-word paraphrase, related control, random control
ROWS = [
    ("idiomatic_nc", "TR-NC-001", "acı reçete", "Uzmanlar açıklanan programı acı reçete olarak niteledi.", "sert önlem paketi", "reçete", "acı ilaç tarifi", "kemer sıkma programı", "kahve fincanı"),
    ("idiomatic_nc", "TR-NC-002", "açık çek", "Kurul bu kararı açık çek olarak görmedi.", "sınırsız yetki", "çek", "doldurulmamış çek", "geniş hareket alanı", "okul bahçesi"),
    ("idiomatic_nc", "TR-NC-003", "ağır top", "Aday listesinde ağır top yer aldı.", "etkili isim", "top", "ağır nesne", "parti yöneticisi", "su şişesi"),
    ("idiomatic_nc", "TR-NC-004", "akıl küpü", "Sınıfın akıl küpü soruyu hemen çözdü.", "çok zeki kişi", "küp", "bilgi dolu kap", "başarılı öğrenci", "duvar saati"),
    ("idiomatic_nc", "TR-NC-005", "altın bilezik", "Ustalık onun için altın bilezik sayılır.", "geçerli meslek", "bilezik", "değerli takı", "iş becerisi", "tren istasyonu"),
    ("idiomatic_nc", "TR-NC-006", "arka bahçe", "Bu bölge şirketin arka bahçe olarak gördüğü bir pazardı.", "denetim alanı", "bahçe", "arka taraftaki bahçe", "etki bölgesi", "telefon numarası"),
    ("idiomatic_nc", "TR-NC-007", "arka kapı", "Sorunu çözmek için arka kapı aradılar.", "gayriresmî yol", "kapı", "arka giriş", "gizli bağlantı", "elektrik faturası"),
    ("idiomatic_nc", "TR-NC-008", "ayak bağı", "Eski borçlar proje için ayak bağı oldu.", "engel", "bağ", "ayağa bağlanan yük", "mali yük", "çocuk kitabı"),
    ("idiomatic_nc", "TR-NC-009", "ayak oyunu", "Bu hamle açıkça ayak oyunu sayıldı.", "gizli hile", "oyun", "ayakla oynanan oyun", "siyasi manevra", "masa lambası"),
    ("idiomatic_nc", "TR-NC-010", "ateş çemberi", "Kasaba kısa sürede ateş çemberi içinde kaldı.", "tehlikeli kuşatma", "çember", "alev halkası", "çatışma bölgesi", "banka hesabı"),
    ("idiomatic_nc", "TR-NC-011", "baba ocağı", "Onun için baba ocağı hâlâ güvenli bir yerdi.", "aile evi", "ocak", "babanın ocağı", "çocukluk evi", "spor salonu"),
    ("idiomatic_nc", "TR-NC-012", "balık hafızası", "Sürekli unutması balık hafızası belirtisiydi.", "zayıf bellek", "hafıza", "balığın belleği", "unutkanlık", "güneş paneli"),
    ("idiomatic_nc", "TR-NC-013", "barut fıçısı", "Bölge uzun süredir barut fıçısı sayılıyor.", "patlamaya hazır ortam", "fıçı", "barut dolu varil", "gerilim bölgesi", "veri tabanı"),
    ("idiomatic_nc", "TR-NC-014", "beyaz perde", "Roman yakında beyaz perde ile buluşacak.", "sinema", "perde", "beyaz ekran", "film dünyası", "iş planı"),
    ("idiomatic_nc", "TR-NC-015", "bit yeniği", "Bu teklifte bit yeniği var.", "kuşkulu ayrıntı", "yeniği", "bit izi", "gizli kusur", "kredi kartı"),
    ("idiomatic_nc", "TR-NC-016", "can damarı", "Ulaşım bölge ekonomisinin can damarı sayılır.", "temel unsur", "damar", "yaşamsal damar", "ana kaynak", "havaalanı terminali"),

    ("compositional_nc", "TR-NC-192", "araştırma projesi", "Kurul yeni araştırma projesi için bütçe ayırdı.", "bilimsel çalışma", "proje", "araştırma çalışması", "akademik girişim", "bit yeniği"),
    ("compositional_nc", "TR-NC-193", "iş planı", "Yatırımcı ayrıntılı iş planı talep etti.", "girişim taslağı", "plan", "çalışma planı", "şirket stratejisi", "yılan hikayesi"),
    ("compositional_nc", "TR-NC-194", "veri tabanı", "Ekip merkezi veri tabanı üzerinde çalışıyor.", "veri deposu", "taban", "bilgi tabanı", "kayıt sistemi", "can simidi"),
    ("compositional_nc", "TR-NC-195", "cep telefonu", "Görevli kayıp cep telefonu buldu.", "mobil telefon", "telefon", "taşınabilir telefon", "iletişim cihazı", "kara koyun"),
    ("compositional_nc", "TR-NC-196", "çocuk kitabı", "Yazar yeni çocuk kitabı yayımladı.", "çocuk yayını", "kitap", "küçükler için kitap", "resimli yayın", "ateş çemberi"),
    ("compositional_nc", "TR-NC-197", "kahve fincanı", "Garson temiz kahve fincanı getirdi.", "kahve kupası", "fincan", "sıcak içecek fincanı", "porselen kap", "açık çek"),
    ("compositional_nc", "TR-NC-198", "okul bahçesi", "Çocuklar geniş okul bahçesi içinde oynadı.", "okul avlusu", "bahçe", "eğitim kurumu bahçesi", "oyun alanı", "barut fıçısı"),
    ("compositional_nc", "TR-NC-199", "şehir merkezi", "Otobüs kalabalık şehir merkezi yönüne gitti.", "kent merkezi", "merkez", "kentin orta bölgesi", "ticaret bölgesi", "balık hafızası"),
    ("compositional_nc", "TR-NC-200", "sınıf öğretmeni", "Toplantıya deneyimli sınıf öğretmeni katıldı.", "ilkokul öğretmeni", "öğretmen", "sınıfın eğitmeni", "eğitimci", "beyaz perde"),
    ("compositional_nc", "TR-NC-201", "trafik ışığı", "Sürücü bozuk trafik ışığı fark etti.", "trafik lambası", "ışık", "yol sinyal lambası", "uyarı sistemi", "baba ocağı"),
    ("compositional_nc", "TR-NC-202", "su şişesi", "Sporcu dolu su şişesi taşıdı.", "su matarası", "şişe", "içecek şişesi", "plastik kap", "arka kapı"),
    ("compositional_nc", "TR-NC-203", "masa lambası", "Öğrenci parlak masa lambası satın aldı.", "çalışma lambası", "lamba", "masa üstü ışığı", "aydınlatma aracı", "ayak oyunu"),
    ("compositional_nc", "TR-NC-204", "duvar saati", "Tamirci eski duvar saati onardı.", "duvar kronometresi", "saat", "duvara asılan saat", "zaman göstergesi", "altın bilezik"),
    ("compositional_nc", "TR-NC-205", "yemek masası", "Aile büyük yemek masası çevresinde toplandı.", "sofra masası", "masa", "yemek için masa", "mobilya", "can damarı"),
    ("compositional_nc", "TR-NC-206", "kitap kapağı", "Tasarımcı renkli kitap kapağı hazırladı.", "eser cildi", "kapak", "yayın dışlığı", "koruyucu yüzey", "ağır top"),
    ("compositional_nc", "TR-NC-207", "bahçe kapısı", "Usta kırık bahçe kapısı değiştirdi.", "bahçe girişi", "kapı", "avlu kapısı", "dış giriş", "acı reçete"),

    ("single_word_control", "", "doktor", "Tanık kendini doktor olarak tanıttı.", "hekim", "", "", "hemşire", "halı"),
    ("single_word_control", "", "öğretmen", "Komite onu öğretmen olarak görevlendirdi.", "eğitmen", "", "", "öğrenci", "dağ"),
    ("single_word_control", "", "avukat", "Şirket onu avukat olarak işe aldı.", "hukukçu", "", "", "yargıç", "yastık"),
    ("single_word_control", "", "araba", "Polis aracı araba olarak kaydetti.", "otomobil", "", "", "otobüs", "salatalık"),
    ("single_word_control", "", "ev", "Belediye yapıyı ev olarak tescilledi.", "konut", "", "", "apartman", "bulut"),
    ("single_word_control", "", "kitap", "Katalog ürünü kitap olarak sınıflandırdı.", "eser", "", "", "dergi", "çekiç"),
    ("single_word_control", "", "çocuk", "Mahkeme başvurucuyu çocuk olarak değerlendirdi.", "evlat", "", "", "ebeveyn", "motor"),
    ("single_word_control", "", "şehir", "Rapor bölgeyi şehir olarak tanımladı.", "kent", "", "", "kasaba", "kaşık"),
    ("single_word_control", "", "yol", "Harita bu hattı yol olarak gösterdi.", "güzergâh", "", "", "sokak", "elma"),
    ("single_word_control", "", "para", "Kasadaki varlığı para olarak kaydettiler.", "nakit", "", "", "banknot", "orman"),
    ("single_word_control", "", "iş", "Danışman faaliyeti iş olarak tanımladı.", "meslek", "", "", "ofis", "yıldız"),
    ("single_word_control", "", "resim", "Editör dosyayı resim olarak ekledi.", "görsel", "", "", "fotoğraf", "motor"),
    ("single_word_control", "", "cevap", "Sistem girdiyi cevap olarak kabul etti.", "yanıt", "", "", "soru", "perde"),
    ("single_word_control", "", "problem", "Ekip durumu problem olarak gördü.", "sorun", "", "", "çözüm", "sandalye"),
    ("single_word_control", "", "hediye", "Paket gümrükte hediye olarak beyan edildi.", "armağan", "", "", "kutu", "nehir"),
    ("single_word_control", "", "toplantı", "Takvim etkinliği toplantı olarak kaydetti.", "oturum", "", "", "konferans", "karpuz"),

    ("ordinary_two_word_control", "", "kırmızı araba", "Kamerada kırmızı araba açıkça görünüyordu.", "al renkli otomobil", "araba", "kızıl taşıt", "bordo araç", "kahve kaşığı"),
    ("ordinary_two_word_control", "", "büyük ev", "Tepenin yanında büyük ev bulunuyordu.", "geniş konut", "ev", "iri yapı", "geniş bina", "mavi kalem"),
    ("ordinary_two_word_control", "", "hızlı tren", "İstasyondan hızlı tren geçti.", "süratli demiryolu aracı", "tren", "çabuk lokomotif", "ekspres hat", "sıcak çorba"),
    ("ordinary_two_word_control", "", "eski kitap", "Rafın üzerinde eski kitap duruyordu.", "antika eser", "kitap", "eski yayın", "tarihî cilt", "yeşil kapı"),
    ("ordinary_two_word_control", "", "soğuk su", "Masada soğuk su bekliyordu.", "serin içecek", "su", "düşük sıcaklıklı su", "buzlu içecek", "uzun yol"),
    ("ordinary_two_word_control", "", "mavi gömlek", "Vitrinde mavi gömlek sergileniyordu.", "lacivert giysi", "gömlek", "mavi kıyafet", "renkli üstlük", "tahta kaşık"),
    ("ordinary_two_word_control", "", "küçük köpek", "Bahçede küçük köpek koşuyordu.", "minik köpek", "köpek", "ufak evcil hayvan", "yavru köpek", "yüksek dağ"),
    ("ordinary_two_word_control", "", "güçlü motor", "Araçta güçlü motor kullanılıyordu.", "kuvvetli makine", "motor", "yüksek güçlü makine", "performanslı düzenek", "sessiz oda"),
    ("ordinary_two_word_control", "", "yeni telefon", "Kutudan yeni telefon çıktı.", "son model cihaz", "telefon", "yeni iletişim cihazı", "akıllı cihaz", "kuru ekmek"),
    ("ordinary_two_word_control", "", "ahşap masa", "Salonda ahşap masa bulunuyordu.", "tahta masa", "masa", "ağaçtan masa", "salon mobilyası", "hızlı cevap"),
    ("ordinary_two_word_control", "", "temiz oda", "Koridorun sonunda temiz oda vardı.", "hijyenik oda", "oda", "pak mekân", "düzenli bölüm", "sarı otobüs"),
    ("ordinary_two_word_control", "", "sıcak çorba", "Tezgâhta sıcak çorba duruyordu.", "ılık yemek", "çorba", "sıcak yemek", "taze başlangıç", "eski köprü"),
    ("ordinary_two_word_control", "", "uzun yol", "Önümüzde uzun yol uzanıyordu.", "uzak güzergâh", "yol", "uzun rota", "şehirlerarası hat", "küçük kalem"),
    ("ordinary_two_word_control", "", "yeşil kapı", "Binada yeşil kapı dikkat çekiyordu.", "zümrüt renkli giriş", "kapı", "yeşil giriş", "boyalı geçit", "tatlı elma"),
    ("ordinary_two_word_control", "", "sakin deniz", "Ufukta sakin deniz görünüyordu.", "durgun deniz", "deniz", "dingin su", "sessiz kıyı", "yeni bilgisayar"),
    ("ordinary_two_word_control", "", "yüksek bina", "Meydanda yüksek bina yükseliyordu.", "uzun yapı", "bina", "yüksek yapı", "çok katlı yapı", "soğuk kahve"),
]

FIELDS = [
    "item_id", "language", "group", "source_mwe_id", "name", "original", "target",
    "synonym", "component", "word_by_word", "related", "random", "sentence_origin",
    "source_name", "source_url", "license", "license_review_status", "semantic_review_status",
    "grammar_review_status", "frequency_match_status", "review_status", "primary_level", "notes",
]


def inventory_index() -> dict[str, dict[str, str]]:
    with INVENTORY.open(encoding="utf-8-sig", newline="") as handle:
        return {row["mwe_id"]: row for row in csv.DictReader(handle)}


def build_rows() -> list[dict[str, str]]:
    inventory = inventory_index()
    output = []
    for index, (group, mwe_id, target, sentence, synonym, component, words, related, random) in enumerate(ROWS, 1):
        if sentence.count(target) != 1:
            raise ValueError(f"Target must occur exactly once: {target!r} in {sentence!r}")
        if not synonym or not random:
            raise ValueError(f"Missing synonym/random for {target}")
        if mwe_id:
            record = inventory[mwe_id]
            expected = "I" if group == "idiomatic_nc" else "C"
            if record["canonical_form"] != target or record["comp_class_provisional"] != expected:
                raise ValueError(f"Inventory mismatch for {mwe_id}: {target}")
        output.append({
            "item_id": f"TR-CTRL-{index:03d}", "language": "TR", "group": group,
            "source_mwe_id": mwe_id, "name": target, "original": sentence, "target": target,
            "synonym": synonym, "component": component, "word_by_word": words, "related": related,
            "random": random, "sentence_origin": "authored_for_dataset",
            "source_name": "NCIMP Turkish extension - Experiment 4 control curation",
            "source_url": "", "license": "project-authored; release license pending",
            "license_review_status": "author_release_confirmation_required",
            "semantic_review_status": "review_required", "grammar_review_status": "review_required",
            "frequency_match_status": "pending_corpus_validation", "review_status": "review_required",
            "primary_level": "contextual_span",
            "notes": "Makale Experiment 4 tasarımına göre hazırlanmış kürasyon adayı; gold değildir.",
        })
    counts = Counter(row["group"] for row in output)
    if counts != {"idiomatic_nc": 16, "compositional_nc": 16, "single_word_control": 16, "ordinary_two_word_control": 16}:
        raise ValueError(f"Unbalanced control set: {counts}")
    return output


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    rows = build_rows()
    write_csv(OUT_CSV, rows)
    write_csv(PUBLIC_CSV, rows)
    payload = {
        "schemaVersion": 1, "protocolVersion": "ncimp-ordinary-calibrated-v2",
        "generatedAt": datetime.now(timezone.utc).isoformat(), "language": "TR",
        "primaryAnalysisLevel": "contextual_span", "releaseStatus": "curation_candidate",
        "method": {
            "articleExperiment": 4, "groupSize": 16,
            "ordinaryGapFormula": "(single_word_control_gap + ordinary_two_word_control_gap) / 2",
            "ocgFormula": "group_synonym_minus_random_gap / ordinary_gap",
            "warning": "Random replacements require corpus-frequency matching and all substitutions require human grammar/semantic review.",
        },
        "summary": {"itemCount": len(rows), "groupCounts": dict(Counter(row["group"] for row in rows))},
        "items": rows,
    }
    PUBLIC_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"csv": str(OUT_CSV.relative_to(ROOT)), "public": str(PUBLIC_JSON.relative_to(ROOT)), "summary": payload["summary"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
