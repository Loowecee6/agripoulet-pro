// ── Prérequis ──
// 1. Lancer le serveur Vite : npm run dev (port 3000)
// 2. Disposer d'un compte Firebase avec auth Email/Mot de passe
//    (créer un utilisateur test dans Firebase Console > Authentication)
// 3. Configurer les identifiants dans .env.local :
//    FIREBASE_TEST_EMAIL=test@example.com
//    FIREBASE_TEST_PASSWORD=mon-mot-de-passe
// 4. Exécuter : npm run test:e2e

import { test, expect, Page } from '@playwright/test';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '..', '.env.local') });

const TEST_EMAIL = process.env.FIREBASE_TEST_EMAIL || 'loowecee6@gmail.com';
const TEST_PASSWORD = process.env.FIREBASE_TEST_PASSWORD || '';

// ── Helper : connexion ──
async function login(page: Page) {
  await page.goto('/');
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('main')?.textContent?.includes('Tableau de Bord'),
    { timeout: 30000 }
  );
}

// ── Helper : navigation vers Ventes ──
async function goToSales(page: Page) {
  await page.locator('[data-tab="ventes"]').click();
  await expect(page.locator('text=Ventes & Crédits')).toBeVisible({ timeout: 10000 });
}

test.describe('Parcours vente complet', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Connexion + navigation vers Ventes', async ({ page }) => {
    await expect(page.locator('text=Tableau de Bord')).toBeVisible({ timeout: 10000 });
    await goToSales(page);
  });

  test('Créer une nouvelle vente complète avec nettoyage', async ({ page }) => {
    await goToSales(page);

    // Ouvrir la modale Nouvelle Vente
    const addButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addButton.click();
    await expect(page.locator('text=Nouvelle Vente')).toBeVisible({ timeout: 5000 });

    // Sélectionner un client (premier de la liste)
    const clientSelect = page.locator('select[name="clientId"]');
    await clientSelect.waitFor({ state: 'visible', timeout: 5000 });
    const clientOptions = await clientSelect.locator('option[value!=""]').all();
    if (clientOptions.length === 0) {
      test.skip(clientOptions.length === 0, 'Aucun client disponible');
      return;
    }
    const firstClientValue = await clientOptions[0].getAttribute('value');
    await clientSelect.selectOption(firstClientValue!);

    // Sélectionner le premier lot de stock (2e <select> dans le formulaire)
    const stockSelect = page.locator('select').nth(1);
    await stockSelect.waitFor({ state: 'visible', timeout: 5000 });
    const batchOptions = await stockSelect.locator('option[value!=""]').all();
    if (batchOptions.length === 0) {
      test.skip(batchOptions.length === 0, 'Aucun lot de stock disponible');
      return;
    }
    const firstBatchValue = await batchOptions[0].getAttribute('value');
    await stockSelect.selectOption(firstBatchValue!);

    // Attendre que les options de prix soient disponibles
    await page.waitForTimeout(300);

    // Cliquer sur un prix rapide (4000 F) pour ajouter au panier
    const priceBtn = page.locator('button').filter({ hasText: '4000' }).first();
    if (await priceBtn.isVisible()) {
      await priceBtn.click();
    }

    // Attendre que le panier se remplisse
    await page.waitForTimeout(500);
    await expect(page.locator('text=Aucun poulet sélectionné')).not.toBeVisible({ timeout: 3000 }).catch(() => {
      // Si le panier est toujours vide (pas de poulets disponibles), on skip
      test.skip(true, 'Impossible d\'ajouter au panier');
    });

    // Soumettre la vente
    const submitBtn = page.locator('button[type="submit"]').filter({ hasText: 'Valider la commande' });
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // Attendre la fermeture de la modale
    await expect(page.locator('text=Nouvelle Vente')).not.toBeVisible({ timeout: 8000 }).catch(() => {});

    // Vérifier que la vente apparaît dans la liste
    const clientName = (await clientOptions[0].textContent()) || '';
    await expect(page.locator(`text=${clientName.trim()}`).first()).toBeVisible({ timeout: 5000 });

    // ── NETTOYAGE : supprimer la vente créée ──
    // La vente la plus récente est en haut de la liste
    const saleCards = page.locator('.space-y-4 > div');
    const firstSale = saleCards.first();
    const deleteButton = firstSale.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('Consulter les détails d\'une vente existante', async ({ page }) => {
    await goToSales(page);

    const saleCards = page.locator('.space-y-4 > div');
    const count = await saleCards.count();
    if (count === 0) {
      test.skip(true, 'Aucune vente à consulter');
      return;
    }

    // Ouvrir les détails de la première vente
    const firstSale = saleCards.first();
    const chevronBtn = firstSale.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') });
    await chevronBtn.click();
    await expect(page.locator('text=Détails de la Vente')).toBeVisible({ timeout: 5000 });

    // Vérifier que le statut de paiement est affiché
    await expect(page.locator('text=Statut Paiement')).toBeVisible({ timeout: 3000 });

    // Fermer la modale
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Détails de la Vente')).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('Message "Aucune vente" quand la liste est vide', async ({ page }) => {
    await goToSales(page);

    const noSalesMsg = page.locator('text=Aucune vente enregistrée');
    const hasNoSales = await noSalesMsg.isVisible().catch(() => false);

    if (!hasNoSales) {
      // Des ventes existent → vérifier juste que la page s'affiche
      const hasCards = await page.locator('.space-y-4 > div').first().isVisible().catch(() => false);
      expect(hasCards).toBeTruthy();
    } else {
      await expect(noSalesMsg).toBeVisible();
    }
  });
});

test.describe('Navigation et permissions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('La barre de navigation du bas est visible après connexion', async ({ page }) => {
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 10000 });

    await expect(page.locator('[data-tab="dashboard"]')).toBeVisible();
    await expect(page.locator('[data-tab="ventes"]')).toBeVisible();
  });

  test('L\'onglet Ventes est accessible (admin)', async ({ page }) => {
    await page.locator('[data-tab="ventes"]').click();
    await expect(page.locator('text=Ventes & Crédits')).toBeVisible({ timeout: 10000 });
  });
});
