# Casamall Livraison — Cloudflare Workers

Plateforme de commandes, stock Atlas, équipe, commissions, coûts et profit. Français, anglais et arabe.

## Correction du déploiement

L’application utilise **Vinext**, pas une construction Next.js/OpenNext. Les fichiers du serveur sont générés dans `dist/server/`, pas dans `.next/`. `wrangler.json` empêche la détection automatique OpenNext. Son étape de construction génère et vérifie le Worker Vinext avant l’envoi.

Dans **Cloudflare → Workers & Pages → casamalllivraison → Settings → Builds** :

| Paramètre | Valeur |
| --- | --- |
| Branche | `main` |
| Root directory | `/` |
| Build command | laisser vide / None |
| Deploy command | `pnpm run deploy` |

Le deploy command construit, publie le Worker puis applique les migrations D1. Le token de build doit avoir **Workers Scripts Edit** et **D1 Edit** pour ce compte. La base `casamalllivraison-db` est créée ou réutilisée par Wrangler. Un manque de permission D1 doit être corrigé dans le compte Cloudflare ; ne mettez aucun token dans le dépôt.

`npx wrangler deploy --config wrangler.json` construit et publie également le Worker, mais n’applique pas les migrations. Utilisez le deploy command ci-dessus pour une plateforme initialisée.

## Activer la plateforme après le premier déploiement

1. Dans l’application Cloudflare Workers, activez **Cloudflare Access** pour le domaine de production et ses previews. Autorisez uniquement votre email et les emails des collaboratrices voulues. Configurez une méthode de connexion (par exemple le code par email).
2. Dans **Settings → Variables and Secrets**, ajoutez les variables runtime suivantes :

| Nom | Valeur |
| --- | --- |
| `OWNER_EMAIL` | Votre email administrateur exact |
| `CF_ACCESS_TEAM_DOMAIN` | Domaine de votre équipe Access, comme `votre-equipe.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Audience (AUD) de l’application Access protégeant ce Worker |
| `ATLAS_API_KEY` | Clé Atlas, à enregistrer comme **Secret** |

Ces variables sont des variables **runtime**, pas uniquement des variables du build. Ne copiez pas la clé Atlas dans GitHub ou les logs.

3. Si Cloudflare demande un redéploiement après modification des variables, redéployez. Connectez-vous avec l’email de `OWNER_EMAIL`, puis créez les sous-comptes dans Équipe. Autorisez leurs emails dans Access également.

Tant que l’accès sécurisé ou la base ne sont pas configurés, la page montre « Configuration de l’hébergement requise ». Les APIs refusent les utilisateurs non authentifiés. Aucun en-tête utilisateur envoyé librement par un client n’est accepté comme identité : signature RSA, issuer, audience et expiration du JWT Access sont vérifiés côté serveur.

## Base de données

Les six migrations existantes sont appliquées sans modification de leur historique. Le script de migration sélectionne uniquement `casamalllivraison-db`, récupère son véritable identifiant et s’arrête si la sélection est ambiguë. Il ne réinitialise pas les données existantes.

Ce déploiement crée une base indépendante. Il **ne transfère pas les anciennes commandes ou comptes de l’hébergement Sites**. La clé Atlas permet de récupérer le stock de votre compte Atlas ; elle n’importe pas automatiquement l’historique local de l’autre hébergement.

## Vérifications et développement

Node.js 22.13 ou plus et pnpm correspondant à `packageManager` dans `package.json`.

```bash
pnpm install --frozen-lockfile
node --experimental-strip-types --test tests/*.test.mjs
pnpm exec tsc --noEmit
pnpm run build
pnpm exec wrangler deploy --config wrangler.json --dry-run
pnpm run db:migrate:local
```

Pour une migration distante déjà provisionnée : `pnpm run db:migrate` (authentification Cloudflare nécessaire). Les identifiants et clés restent hors du dépôt.
