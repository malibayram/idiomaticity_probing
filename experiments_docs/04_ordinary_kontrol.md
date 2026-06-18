# Deney 4 — Ordinary-Perturbation Kontrolü (20 model)

## Amaç
Deney 1-3'te modeller idiyomatik NC'lerde başarısız oldu. **Ama bu başarısızlık idiyomatikliğe mi
özgü, yoksa embedding+kosinüs düzeneğinin genel bir duyarsızlığı mı?** Bunu ayırmak için aynı
synonym/random testini **idiyomatik olmayan** sıradan kelime ve ifadelerde de yaparız. Bu, makalede
eksik olan **kontrol kalibrasyonudur**.

## Veri setinden örnekler (kullanıcının `control_examples.csv`'si, 64 örnek, 4 grup × 16)
| Grup | Örnek hedef | Cümle | synonym | random |
|------|-------------|-------|---------|--------|
| `idiomatic_nc` | grey matter | "These youngsters use their **grey matter**…" | brain | battlefront serviceman |
| `compositional_nc` | economic aid | "…giving Cuba **economic aid**…" | financial assistance | (rastgele) |
| `single_word_control` | **doctor** | "The **doctor** examined the patient." | physician | carpet |
| `ordinary_two_word_control` | **red car** | "A **red car** was parked outside." | crimson vehicle | coffee spoon |

Son iki grup **idiyomatik değildir** — burada synonym/random ayrımı kolayca beklenir.

## Beklenen sonuç (örnek cümleyle)
> Örnek `doctor` (sıradan kelime): model "doctor↔physician"ı (synonym) yüksek, "doctor↔carpet"i
> (random) düşük vermeli — bu **kolay** bir ayrım, çünkü idiyomatiklik yok.

> Örnek `grey matter` (idiyomatik): eğer model gerçekten idiyomatikliği yakalıyorsa, burada da
> "grey matter↔brain"i yüksek vermeli. **Beklenti:** idiyomatik ayrım, sıradan ayrıma **yakın**
> olmalı (OCG_idiom ≈ 1). Eğer idiyomatiklik özel bir zorluksa, OCG_idiom ≪ 1 çıkar.

**OCG_idiom** = idiyomatik(synonym−random) / sıradan(synonym−random). 1 = sıradan kadar iyi; <1 =
daha kötü.

## Gerçek sonuç — örnek cümle üzerinden (mBERT, contextual-span)
| Hedef | grup | synonym | random | gap |
|-------|------|---------|--------|-----|
| **doctor** | sıradan kelime | 0.933 | 0.770 | **+0.163** ✅ iyi ayrışıyor |
| **grey matter** (grup ort.) | idiyomatik | ~0.66 | ~0.67 | **−0.012** ❌ ayrışmıyor |

→ mBERT sıradan kelimede synonym'i random'dan net ayırıyor (0.16), ama idiyomatik grupta synonym
random'dan **iyi değil** (hatta hafif düşük). Yani sorun ölçüm düzeneği değil, **idiyomatikliğin
kendisi.**

## Gerçek sonuç — tam tablo (20 model, OCG_idiom sıralı)
| Model | idiom gap | comp gap | ordinary gap | **OCG_idiom** | OCG_comp |
|-------|-----------|----------|--------------|---------------|----------|
| Gemma4-12B-base | +0.186 | +0.305 | +0.273 | **0.68** | 1.12 |
| Qwen3.5-4B-it | +0.147 | +0.309 | +0.242 | 0.61 | 1.28 |
| Qwen3.5-9B-it | +0.138 | +0.299 | +0.229 | 0.61 | 1.31 |
| Gemma3-12B-pt | +0.155 | +0.299 | +0.273 | 0.57 | 1.09 |
| Gemma4-E2B-base | +0.066 | +0.139 | +0.121 | 0.55 | 1.16 |
| Gemma3-4B-pt | +0.109 | +0.223 | +0.205 | 0.53 | 1.09 |
| Qwen3.5-2B-it | +0.121 | +0.310 | +0.245 | 0.50 | 1.27 |
| Qwen3-Emb-4B | +0.139 | +0.377 | +0.284 | 0.49 | 1.33 |
| Qwen3-4B-Base | +0.054 | +0.111 | +0.117 | 0.46 | 0.95 |
| BGE-M3 | +0.097 | +0.387 | +0.254 | 0.38 | 1.52 |
| Qwen3.5-0.8B-base | +0.092 | +0.301 | +0.252 | 0.36 | 1.19 |
| mE5-large-instruct | +0.042 | +0.131 | +0.115 | 0.36 | 1.14 |
| Gemma3-1B-it | +0.074 | +0.250 | +0.227 | 0.33 | 1.10 |
| E5-large | +0.027 | +0.120 | +0.088 | 0.31 | 1.36 |
| Qwen3-Emb-0.6B | +0.070 | +0.324 | +0.267 | 0.26 | 1.22 |
| mSBERT | +0.053 | +0.578 | +0.533 | 0.10 | 1.09 |
| XLM-R-large | −0.000 | +0.049 | +0.037 | −0.01 | 1.31 |
| DistilBERT-ML | −0.011 | +0.152 | +0.115 | −0.09 | 1.32 |
| mBERT | −0.012 | +0.123 | +0.124 | −0.09 | 0.99 |
| Gemma4-12B-it* | +0.001 | +0.011 | +0.003 | 0.20 | 3.40 |

*\*Gemma4-12B-it: çökük uzay (ordinary gap ~0) → OCG kararsız, artefakt.*

## Yorum (örneklerle)
1. **OCG_idiom hiçbir modelde ≥1 değil** (max 0.68). Yani **her modelde** idiyomatik synonym/random
   ayrımı, sıradan kelime/ifadelerden zayıf.
   > Örnek: en iyi model Gemma4-12B-base bile idiyomda (0.186) sıradanın (0.273) sadece %68'i kadar
   > ayrışıyor. "grey matter↔brain" ayrımı, "doctor↔physician" ayrımının yetersiz bir gölgesi.
2. **OCG_comp ≈ 1 (çoğu >1).** Kompozisyonel NC'ler (economic aid) sıradanlar kadar — hatta daha
   iyi — ayrışıyor. Yani **sorun idiyomatikliğe özgü**, genel duyarsızlık değil.
   > Örnek: BGE-M3'te economic aid gap (0.387) > sıradan gap (0.254) → OCG_comp 1.52; ama grey
   > matter gap (0.097) ≪ sıradan → OCG_idiom 0.38.
3. **Eski encoder'lar en kötü:** mBERT/DistilBERT/XLM-R'de OCG_idiom ≈ 0 veya **negatif** — idiyomda
   synonym, random'dan iyi değil.

**Bu deneyin katkısı:** Makalenin idiyomatiklik iddiasını **metodolojik olarak sağlamlaştırıyor.**
"Modeller idiyomatikliği yakalamıyor" demek için, başarısızlığın sıradan kelimelerde olmadığını
göstermek gerekir — bu kontrol tam onu yapıyor.

**Çıktılar:** `experiments/perturbation_control/all_models/` (her model + `summary_table.csv`).
