# Deney 2 - Modern Embedding Modelleri (2025-2026)

## Amaç

Makale 2024 modellerinde durdu. **Yeni nesil SOTA cümle-embedding modelleri** (Qwen3-Embedding,
multilingual-E5-instruct) idiyomatikliği daha iyi yakalıyor mu? Bu modeller MTEB liderlik
tablolarında üst sıralarda - ama bu, idiyomatik anlamı temsil etmek anlamına geliyor mu?

**Modeller:** Qwen3-Emb-0.6B, Qwen3-Emb-4B (2025), mE5-large-instruct (2024 instruct).

## Önemli metodolojik fark (örnekle)

Bu modeller **cümle-embedding** üretir: tek bir vektör. Çerçevede:

- `sentence` düzeyi = tam cümle embedding'i
- `NC` düzeyi = **izole-ifade** embedding'i (ifadeyi tek başına encode)

> Örnek: `grey matter` için bu modeller, **bağlamsal token span'i** veremez. Bunun yerine
> "grey matter" ve "brain" kelimelerini **tek başına** encode edip kıyaslarız. Yani encoder/LLM'in
> "cümleyi gördükten sonraki span temsili"nden farklıdır - bu ayrım sonuç yorumunda akılda
> tutulmalı.

## Veri ve beklenen sonuç (örnek cümleyle)

Aynı NCIMP probları (P_Syn/P_Comp/P_WordsSyn/P_Rand).

> Örnek `grey matter` (idiyomatik): iyi bir embedding modeli, izole "grey matter" ile izole
> "brain"i (P_Syn) yüksek; "silvery material" (P_WordsSyn) ile düşük benzerlik vermeli.
> Beklenti: ISC yüksek, LOD negatif.

> Örnek `economic aid` (kompozisyonel): "economic aid" ↔ "financial assistance" yüksek olmalı -
> ve burada kelime-kelime "budgetary assistance"ın da yüksek olması normaldir.

## Gerçek sonuç - kohort tablosu (EN, NC/izole-ifade düzeyi)

| Model              | Nesil | ISC↑  | LOD↓  | FLOOR | ICS↑      | Hüküm       |
| ------------------ | ----- | ----- | ----- | ----- | --------- | ----------- |
| **Qwen3-Emb-4B**   | 2025  | 0.300 | 0.043 | 0.509 | **0.478** | yakalamıyor |
| mE5-large-instruct | 2024  | 0.316 | 0.091 | 0.834 | 0.460     | yakalamıyor |
| Qwen3-Emb-0.6B     | 2025  | 0.201 | 0.149 | 0.543 | 0.401     | yakalamıyor |

Karşılaştırma için Deney 1'in en iyi 2024 embedding'i: **E5-large 0.438**, BGE-M3 0.428.

## Yorum (örnekle)

1. **En iyi modern embedding (Qwen3-Emb-4B, 0.478)**, en iyi 2024 modelinden (E5-large 0.438) biraz
   daha iyi ama **yine <0.55** - yakalamıyor.
2. **İki farklı aile aynı tavanda buluşuyor:** Qwen3-Emb-4B (0.478) ≈ decoder Qwen3-4B LLM (0.479)
   - ikisi de LOD≈0 ama eşik altında.
3. **Düşük anizotropi yetmiyor:** Qwen3-Emb modelleri görece sağlıklı uzaya sahip (FLOOR ~0.51) ama
   yine de eşiği geçemiyor; mE5'in anizotropisi yüksek (0.834) ama ICS'i benzer. Yani ne
   kompozisyonel önyargıyı azaltmak ne anizotropiyi azaltmak tek başına yeterli.

> Somut: Qwen3-Emb-4B idiyomatik NC'lerde ISC=0.30, yani izole "grey matter"ı "brain"e ortalama
> sadece %30 düzeyinde (rastgele tabanın üstünde) yaklaştırıyor - gerçek bir anlam köprüsü değil.

**Çıktılar:** `runs/emb_Qwen3-Emb-0.6B/`, `runs/emb_Qwen3-Emb-4B/`, `runs/emb_mE5-large-instruct/`.
