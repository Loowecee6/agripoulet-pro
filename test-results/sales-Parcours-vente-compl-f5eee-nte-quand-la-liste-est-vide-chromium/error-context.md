# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sales.spec.ts >> Parcours vente complet >> Message "Aucune vente" quand la liste est vide
- Location: e2e\sales.spec.ts:135:3

# Error details

```
Test timeout of 60000ms exceeded while running "beforeEach" hook.
```

```
Error: page.waitForFunction: Test timeout of 60000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e6]:
  - img [ref=e8]
  - heading "AgriPoulet Pro" [level=1] [ref=e15]
  - paragraph [ref=e16]: Connexion Sécurisée
  - generic [ref=e17]:
    - generic [ref=e18]:
      - img [ref=e19]
      - text: Trop de tentatives. Réessayez plus tard.
    - textbox "Adresse email" [ref=e21]: loowecee6@gmail.com
    - textbox "Mot de passe (min. 6 caractères)" [ref=e22]: W0rk4M0ney@2026
    - button "Se Connecter" [ref=e23] [cursor=pointer]:
      - img [ref=e24]
      - text: Se Connecter
  - button "Pas encore de compte ? Créer un compte" [ref=e27] [cursor=pointer]
  - paragraph [ref=e28]: Cloud Google Infrastructure • Real-time Sync
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | import { config } from 'dotenv';
  3   | import { resolve, dirname } from 'path';
  4   | import { fileURLToPath } from 'url';
  5   | 
  6   | const __filename = fileURLToPath(import.meta.url);
  7   | const __dirname = dirname(__filename);
  8   | config({ path: resolve(__dirname, '..', '.env.local') });
  9   | 
  10  | const TEST_EMAIL = process.env.FIREBASE_TEST_EMAIL || 'loowecee6@gmail.com';
  11  | const TEST_PASSWORD = process.env.FIREBASE_TEST_PASSWORD || '';
  12  | 
  13  | // ── Helper : connexion ──
  14  | async function login(page: Page) {
  15  |   await page.goto('/');
  16  |   await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  17  |   await page.fill('input[type="email"]', TEST_EMAIL);
  18  |   await page.fill('input[type="password"]', TEST_PASSWORD);
  19  |   await page.click('button[type="submit"]');
> 20  |   await page.waitForFunction(
      |              ^ Error: page.waitForFunction: Test timeout of 60000ms exceeded.
  21  |     () => document.querySelector('main')?.textContent?.includes('Tableau de Bord'),
  22  |     { timeout: 30000 }
  23  |   );
  24  | }
  25  | 
  26  | // ── Helper : navigation vers Ventes ──
  27  | async function goToSales(page: Page) {
  28  |   await page.locator('[data-tab="ventes"]').click();
  29  |   await expect(page.locator('text=Ventes & Crédits')).toBeVisible({ timeout: 10000 });
  30  | }
  31  | 
  32  | test.describe('Parcours vente complet', () => {
  33  |   test.beforeEach(async ({ page }) => {
  34  |     await login(page);
  35  |   });
  36  | 
  37  |   test('Connexion + navigation vers Ventes', async ({ page }) => {
  38  |     await expect(page.locator('text=Tableau de Bord')).toBeVisible({ timeout: 10000 });
  39  |     await goToSales(page);
  40  |   });
  41  | 
  42  |   test('Créer une nouvelle vente complète avec nettoyage', async ({ page }) => {
  43  |     await goToSales(page);
  44  | 
  45  |     // Ouvrir la modale Nouvelle Vente
  46  |     const addButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
  47  |     await addButton.click();
  48  |     await expect(page.locator('text=Nouvelle Vente')).toBeVisible({ timeout: 5000 });
  49  | 
  50  |     // Sélectionner un client (premier de la liste)
  51  |     const clientSelect = page.locator('select[name="clientId"]');
  52  |     await clientSelect.waitFor({ state: 'visible', timeout: 5000 });
  53  |     const clientOptions = await clientSelect.locator('option[value!=""]').all();
  54  |     if (clientOptions.length === 0) {
  55  |       test.skip(clientOptions.length === 0, 'Aucun client disponible');
  56  |       return;
  57  |     }
  58  |     const firstClientValue = await clientOptions[0].getAttribute('value');
  59  |     await clientSelect.selectOption(firstClientValue!);
  60  | 
  61  |     // Sélectionner le premier lot de stock (2e <select> dans le formulaire)
  62  |     const stockSelect = page.locator('select').nth(1);
  63  |     await stockSelect.waitFor({ state: 'visible', timeout: 5000 });
  64  |     const batchOptions = await stockSelect.locator('option[value!=""]').all();
  65  |     if (batchOptions.length === 0) {
  66  |       test.skip(batchOptions.length === 0, 'Aucun lot de stock disponible');
  67  |       return;
  68  |     }
  69  |     const firstBatchValue = await batchOptions[0].getAttribute('value');
  70  |     await stockSelect.selectOption(firstBatchValue!);
  71  | 
  72  |     // Attendre que les options de prix soient disponibles
  73  |     await page.waitForTimeout(300);
  74  | 
  75  |     // Cliquer sur un prix rapide (4000 F) pour ajouter au panier
  76  |     const priceBtn = page.locator('button').filter({ hasText: '4000' }).first();
  77  |     if (await priceBtn.isVisible()) {
  78  |       await priceBtn.click();
  79  |     }
  80  | 
  81  |     // Attendre que le panier se remplisse
  82  |     await page.waitForTimeout(500);
  83  |     await expect(page.locator('text=Aucun poulet sélectionné')).not.toBeVisible({ timeout: 3000 }).catch(() => {
  84  |       // Si le panier est toujours vide (pas de poulets disponibles), on skip
  85  |       test.skip(true, 'Impossible d\'ajouter au panier');
  86  |     });
  87  | 
  88  |     // Soumettre la vente
  89  |     const submitBtn = page.locator('button[type="submit"]').filter({ hasText: 'Valider la commande' });
  90  |     await expect(submitBtn).toBeEnabled({ timeout: 3000 });
  91  |     await submitBtn.click();
  92  | 
  93  |     // Attendre la fermeture de la modale
  94  |     await expect(page.locator('text=Nouvelle Vente')).not.toBeVisible({ timeout: 8000 }).catch(() => {});
  95  | 
  96  |     // Vérifier que la vente apparaît dans la liste
  97  |     const clientName = (await clientOptions[0].textContent()) || '';
  98  |     await expect(page.locator(`text=${clientName.trim()}`).first()).toBeVisible({ timeout: 5000 });
  99  | 
  100 |     // ── NETTOYAGE : supprimer la vente créée ──
  101 |     // La vente la plus récente est en haut de la liste
  102 |     const saleCards = page.locator('.space-y-4 > div');
  103 |     const firstSale = saleCards.first();
  104 |     const deleteButton = firstSale.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
  105 |     if (await deleteButton.isVisible()) {
  106 |       await deleteButton.click();
  107 |       await page.waitForTimeout(500);
  108 |     }
  109 |   });
  110 | 
  111 |   test('Consulter les détails d\'une vente existante', async ({ page }) => {
  112 |     await goToSales(page);
  113 | 
  114 |     const saleCards = page.locator('.space-y-4 > div');
  115 |     const count = await saleCards.count();
  116 |     if (count === 0) {
  117 |       test.skip(true, 'Aucune vente à consulter');
  118 |       return;
  119 |     }
  120 | 
```