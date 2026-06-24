# Deney 3 - Decoder-Only LLM Kohortu (Qwen3/3.5, Gemma 3/4)

## Amaç

**Ana araştırma sorusu:** Bu sürede her alanda gelişen yapay zeka modelleri idiyomatiklik
temsilinde de ilerledi mi? Ölçek (0.8B→12B), nesil (2025→2026), tip (base/instruct) idiyomatikliği
çözüyor mu? Decoder-only LLM'lerin **bağlamsal gizli-katman** temsillerini probe ederiz.

**11 model:** Qwen3-4B (2025), Qwen3.5 0.8B/2B/4B/9B (2026), Gemma3 1B/4B/12B (2025), Gemma4 E2B/12B
(2026), base & instruct.

## Metodoloji (örnekle)

LLM'in metin omurgasının **son-4 katman ortalaması + final-norm** alınır (encoder reçetesiyle aynı).
İki çalışma zamanı: standart modeller torch; Qwen3.5 (linear attention) ve Gemma 4 (multimodal)
**Apple MLX** (mlx-lm + mlx-vlm). Decoder LLM'lerin ham residual akışı norm'suz aşırı anizotropiktir.

> Örnek: norm'suz ham son-4'te `grey matter` ile alakasız `supermarket city` arasındaki benzerlik
> Gemma'da 0.98 çıkıyor (her şey benzer = uzay çökük). Modelin **kendi final-norm**'unu uygulayınca
> bu 0.56'ya iner ve anlamlı ölçüm mümkün olur. Bu yüzden son-4+norm reçetesi şart.

## Beklenen sonuç (örnek cümleyle)

> Örnek `grey matter`: idiyomatikliği gerçekten kavrayan bir LLM, cümle içindeki "grey matter" span
> temsilini "brain" span'ine yakın, "silvery material"a uzak konumlandırmalı (ISC yüksek, LOD<0,
> AID>0). **Hipotez H1:** daha yeni/büyük modeller bunu daha iyi yapar. **Hipotez H0:** ölçek bunu
> çözmez (yapısal darboğaz).

## Gerçek sonuç - tam tablo (EN, bağlamsal-span, ICS sıralı)

| Model               | Nesil/Tip     | ISC↑   | LOD↓       | FLOOR | ICS↑         |
| ------------------- | ------------- | ------ | ---------- | ----- | ------------ |
| **Gemma4-12B-base** | 2026 base     | +0.260 | **−0.033** | 0.531 | **0.525** 🏆 |
| Gemma4-12B-it       | 2026 instruct | −0.006 | +0.010     | 0.949 | 0.520\*      |
| Gemma3-4B-pt        | 2025 base     | +0.254 | +0.008     | 0.682 | 0.499        |
| Gemma3-12B-pt       | 2025 base     | +0.258 | −0.006     | 0.556 | 0.498        |
| Gemma4-E2B-base     | 2026 base     | +0.213 | +0.025     | 0.812 | 0.490        |
| Qwen3.5-4B-it       | 2026 instruct | +0.222 | +0.011     | 0.523 | 0.479        |
| Qwen3-4B-Base       | 2025 base     | +0.188 | +0.050     | 0.825 | 0.479        |
| Qwen3.5-9B-it       | 2026 instruct | +0.217 | +0.010     | 0.540 | 0.478        |
| Gemma3-1B-it        | 2025 instruct | +0.207 | +0.080     | 0.667 | 0.455        |
| Qwen3.5-2B-it       | 2026 instruct | +0.200 | +0.060     | 0.511 | 0.444        |
| Qwen3.5-0.8B-base   | 2026 base     | +0.186 | +0.101     | 0.561 | 0.425        |

_\*Gemma4-12B-**it**: FLOOR 0.949 (uzay çökük, instruct hizalaması) → ISC≈0, gerçek sinyal yok;
ICS 0.520 metrik artefaktı, gerçek değil. Bkz. base versiyonu (0.525, FLOOR 0.531, gerçek)._

## Yorum - üç bulgu (örneklerle)

1. **Hiçbir model 0.55'i geçmiyor.** Tüm kohort 0.42-0.525 arası, 2024 encoder'larla aynı bantta.
2. **Başarısızlık modu kaydı:** Encoder'larda LOD>0 (idiyom=parçaların toplamı) baskındı;
   decoder LLM'lerde LOD≈0'a iniyor.
   > Örnek: Gemma4-12B-base'de `grey matter` için LOD=−0.033 → ilk kez "brain"i "silvery material"a
   > **tercih ediyor** (doğru yön!). Ama yine de ISC sadece 0.26 ve eşik altında.
3. **Ölçek/nesil tavanı kıramıyor:** Qwen3.5'te ICS ~4B'den itibaren sabitleniyor (0.48); Gemma 3
   ve 4 base modelleri 0.49-0.52'de buluşuyor.
   > Örnek: adil base-vs-base 12B karşılaştırması: Gemma 4 (0.525) > Gemma 3 (0.498) - yeni nesil
   > **biraz** daha iyi, ama fark küçük ve ikisi de eşiği aşamıyor.

**Sonuç:** En yeni base model (Gemma 4 12B) eşiğe **en çok yaklaşan ve doğru sinyali veren ilk
model** - yine de geçemiyor. **H0 (yapısal darboğaz)** baskın: ölçek/nesil/hizalama yaklaştırıyor,
çözmüyor.

**Çıktılar:** `runs/llm_*`, `runs/small_*`, `runs/qwen4_en/` ·
`article_perturbation_calibration/tables/llm_diagnostics.csv`.
