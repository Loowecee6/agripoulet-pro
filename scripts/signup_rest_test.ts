// signup_rest_test.ts – Test création de compte via l'API REST Firebase
// Contourne les limitations du SDK client en Node.js

const API_KEY = "AIzaSyD7XQFxRQUpfXdYFaW_Io3-VP_kGx5eqRk";
const SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🔍 TEST CRÉATION DE COMPTE – API REST Firebase");
  console.log("═══════════════════════════════════════════════\n");

  const testEmail = `test_${Date.now()}@agripoulet-test.com`;
  const testPassword = "TestPass123!";

  console.log("📧 Email  :", testEmail);
  console.log("🔑 Mot de passe :", testPassword);
  console.log("🔗 API Key :", API_KEY);
  console.log("🌐 URL    :", SIGNUP_URL);
  console.log("");

  try {
    const response = await fetch(SIGNUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        returnSecureToken: true,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Compte créé avec succès !");
      console.log("  📋 UID       :", data.localId);
      console.log("  📧 Email     :", data.email);
      console.log("  🔑 ID Token  :", data.idToken?.substring(0, 40) + "...");
      console.log("  🔄 Refresh   :", data.refreshToken?.substring(0, 30) + "...");
    } else {
      console.error("❌ Erreur de création :");
      console.error("  📋 Code    :", data.error?.code);
      console.error("  📋 Message :", data.error?.message);
      console.error("  📋 Détails :", JSON.stringify(data.error?.errors, null, 2));

      if (data.error?.message === "CONFIGURATION_NOT_FOUND") {
        console.error("\n  🚨 La clé API ne correspond à aucun projet avec Auth activé.");
        console.error("  💡 Vérifiez dans Firebase Console :");
        console.error("     Paramètres → Général → Vos applications → Config SDK");
        console.error("     Et comparez l'apiKey avec celle du code.");
      }
    }
  } catch (e: any) {
    console.error("💥 Erreur réseau :", e.message);
  }

  console.log("\n═══════════════════════════════════════════════");
}

main();
