# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sales.spec.ts >> Navigation et permissions >> L'onglet Ventes est accessible (admin)
- Location: e2e\sales.spec.ts:164:3

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
      - text: Email ou mot de passe incorrect.
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
  1   | // ── Prérequis ──
  2   | // 1. Lancer le serveur Vite : npm run dev (port 3000)
  3   | // 2. Disposer d'un compte Firebase avec auth Email/Mot de passe
  4   | //    (créer un utilisateur test dans Firebase Console > Authentication)
  5   | // 3. Configurer les identifiants dans .env.local :
  6   | //    FIREBASE_TEST_EMAIL=test@example.com
  7   | //    FIREBASE_TEST_PASSWORD=mon-mot-de-passe
  8   | // 4. Exécuter : npm run test:e2e
  9   | 
  10  | import { test, expect, Page } from '@playwright/test';
  11  | import { config } from 'dotenv';
  12  | import { resolve, dirname } from 'path';
  13  | import { fileURLToPath } from 'url';
  14  | 
  15  | const __filename = fileURLToPath(import.meta.url);
  16  | const __dirname = dirname(__filename);
  17  | config({ path: resolve(__dirname, '..', '.env.local') });
  18  | 
  19  | const TEST_EMAIL = process.env.FIREBASE_TEST_EMAIL || 'loowecee6@gmail.com';
> 20  | const TEST_PASSWORD = process.env.FIREBASE_TEST_PASSWORD || '';
      |              ^ Error: page.waitForFunction: Test timeout of 60000ms exceeded.
  21  | 
  22  | // ── Helper : connexion ──
  23  | async function login(page: Page) {
  24  |   await page.goto('/');
  25  |   await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  26  |   await page.fill('input[type="email"]', TEST_EMAIL);
  27  |   await page.fill('input[type="password"]', TEST_PASSWORD);
  28  |   await page.click('button[type="submit"]');
  29  |   await page.waitForFunction(
  30  |     () => document.querySelector('main')?.textContent?.includes('Tableau de Bord'),
  31  |     { timeout: 30000 }
  32  |   );
  33  | }
  34  | 
  35  | // ── Helper : navigation vers Ventes ──
  36  | async function goToSales(page: Page) {
  37  |   await page.locator('[data-tab="ventes"]').click();
  38  |   await expect(page.locator('text=Ventes & Crédits')).toBeVisible({ timeout: 10000 });
  39  | }
  40  | 
  41  | test.describe('Parcours vente complet', () => {
  42  |   test.beforeEach(async ({ page }) => {
  43  |     await login(page);
  44  |   });
  45  | 
  46  |   test('Connexion + navigation vers Ventes', async ({ page }) => {
  47  |     await expect(page.locator('text=Tableau de Bord')).toBeVisible({ timeout: 10000 });
  48  |     await goToSales(page);
  49  |   });
  50  | 
  51  |   test('Créer une nouvelle vente complète avec nettoyage', async ({ page }) => {
  52  |     await goToSales(page);
  53  | 
  54  |     // Ouvrir la modale Nouvelle Vente
  55  |     const addButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
  56  |     await addButton.click();
  57  |     await expect(page.locator('text=Nouvelle Vente')).toBeVisible({ timeout: 5000 });
  58  | 
  59  |     // Sélectionner un client (premier de la liste)
  60  |     const clientSelect = page.locator('select[name="clientId"]');
  61  |     await clientSelect.waitFor({ state: 'visible', timeout: 5000 });
  62  |     const clientOptions = await clientSelect.locator('option[value!=""]').all();
  63  |     if (clientOptions.length === 0) {
  64  |       test.skip(clientOptions.length === 0, 'Aucun client disponible');
  65  |       return;
  66  |     }
  67  |     const firstClientValue = await clientOptions[0].getAttribute('value');
  68  |     await clientSelect.selectOption(firstClientValue!);
  69  | 
  70  |     // Sélectionner le premier lot de stock (2e <select> dans le formulaire)
  71  |     const stockSelect = page.locator('select').nth(1);
  72  |     await stockSelect.waitFor({ state: 'visible', timeout: 5000 });
  73  |     const batchOptions = await stockSelect.locator('option[value!=""]').all();
  74  |     if (batchOptions.length === 0) {
  75  |       test.skip(batchOptions.length === 0, 'Aucun lot de stock disponible');
  76  |       return;
  77  |     }
  78  |     const firstBatchValue = await batchOptions[0].getAttribute('value');
  79  |     await stockSelect.selectOption(firstBatchValue!);
  80  | 
  81  |     // Attendre que les options de prix soient disponibles
  82  |     await page.waitForTimeout(300);
  83  | 
  84  |     // Cliquer sur un prix rapide (4000 F) pour ajouter au panier
  85  |     const priceBtn = page.locator('button').filter({ hasText: '4000' }).first();
  86  |     if (await priceBtn.isVisible()) {
  87  |       await priceBtn.click();
  88  |     }
  89  | 
  90  |     // Attendre que le panier se remplisse
  91  |     await page.waitForTimeout(500);
  92  |     await expect(page.locator('text=Aucun poulet sélectionné')).not.toBeVisible({ timeout: 3000 }).catch(() => {
  93  |       // Si le panier est toujours vide (pas de poulets disponibles), on skip
  94  |       test.skip(true, 'Impossible d\'ajouter au panier');
  95  |     });
  96  | 
  97  |     // Soumettre la vente
  98  |     const submitBtn = page.locator('button[type="submit"]').filter({ hasText: 'Valider la commande' });
  99  |     await expect(submitBtn).toBeEnabled({ timeout: 3000 });
  100 |     await submitBtn.click();
  101 | 
  102 |     // Attendre la fermeture de la modale
  103 |     await expect(page.locator('text=Nouvelle Vente')).not.toBeVisible({ timeout: 8000 }).catch(() => {});
  104 | 
  105 |     // Vérifier que la vente apparaît dans la liste
  106 |     const clientName = (await clientOptions[0].textContent()) || '';
  107 |     await expect(page.locator(`text=${clientName.trim()}`).first()).toBeVisible({ timeout: 5000 });
  108 | 
  109 |     // ── NETTOYAGE : supprimer la vente créée ──
  110 |     // La vente la plus récente est en haut de la liste
  111 |     const saleCards = page.locator('.space-y-4 > div');
  112 |     const firstSale = saleCards.first();
  113 |     const deleteButton = firstSale.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
  114 |     if (await deleteButton.isVisible()) {
  115 |       await deleteButton.click();
  116 |       await page.waitForTimeout(500);
  117 |     }
  118 |   });
  119 | 
  120 |   test('Consulter les détails d\'une vente existante', async ({ page }) => {
```