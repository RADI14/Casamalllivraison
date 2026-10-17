# Commandes · Équipe — code source pour GitHub

## Mettre le projet dans GitHub rapidement

1. Décompressez `commandes-github.zip` sur votre ordinateur.
2. Sur GitHub : **New repository** → nom `commandes-equipe` → **Private** → **Create repository**.
3. Cliquez **uploading an existing file** (ou **Add file → Upload files**).
4. Glissez les fichiers et dossiers décompressés, puis **Commit changes**.
   GitHub doit afficher `package.json`, `app/`, `db/` et `drizzle/` directement à la racine.
   Si le navigateur limite le nombre de fichiers, faites plusieurs envois.

Le code est maintenant dans votre propre dépôt GitHub. Aucun compte GitHub n’a été connecté et aucun dépôt n’a été créé automatiquement pour vous.

## Ce qui est inclus

- Commandes et stock Atlas, tableau de bord, comptes de l’équipe.
- Commissions et historique des paiements, coûts produits et publicités.
- Frais de transport fournis par Atlas, français / anglais / arabe.
- Schéma de base de données, migrations et tests.

## Hébergement et données

Le dépôt contient le **code source complet**, pas les données de production.
La plateforme actuelle continue de fonctionner à cette adresse :
https://commandes-mehdi-team.freshpony.chatgpt.site

**GitHub Pages ne peut pas exécuter cette application complète.** Elle utilise un serveur Cloudflare Workers, une base D1 et l’authentification de l’hébergement actuel. Ce ZIP ne migre pas ces services et ne configure pas de nouvel hébergement.

Un déploiement indépendant nécessite une configuration Workers/D1 propre, une authentification vérifiée côté serveur et une migration des données. Le module `app/chatgpt-auth.ts` repose actuellement sur les en-têtes authentifiés du service d’hébergement : ne pas faire confiance à ces en-têtes sur un serveur public indépendant.

## Clés et configuration

Aucune clé Atlas, aucun jeton Git, aucun fichier `.env`, aucune base clients n’est inclus.
Les valeurs `ATLAS_API_KEY` et `OWNER_EMAIL` doivent être configurées côté serveur pour tout futur déploiement. Ne mettez pas la clé Atlas dans les fichiers du dépôt.

`.openai/hosting.json` conserve uniquement les noms de bindings génériques, sans identifiant du site existant. Ne l’utilisez pas pour écraser le site actuel.

## Tests

Prérequis : Node.js 22.13 ou plus, pnpm correspondant au champ `packageManager` de `package.json`.

```bash
pnpm install --frozen-lockfile
node --experimental-strip-types --test tests/*.test.mjs
```

La configuration de construction conservée dépend du runtime Sites et doit être adaptée avant un déploiement indépendant. Ce paquet est prêt pour l’import du code dans GitHub ; il n’est pas un déploiement autonome en un clic.
