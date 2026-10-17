# Casamall Livraison — Railway

Commandes, stock Atlas, équipe, commissions et profit en français, anglais et arabe. Cette branche `railway` fonctionne sous Node.js 24 avec une base SQLite sur volume persistant. Aucun compte Cloudflare ou Cloudflare Access n’est nécessaire.

## Déployer

1. Dans Railway : New Project → Deploy from GitHub Repo → RADI14/Casamalllivraison. Sélectionner la branche **railway** dans les paramètres Source. Le Dockerfile et railway.json configurent la construction et le démarrage.
2. Ajouter un **Volume** à ce service, chemin de montage **/data**. Garder **une seule instance** ; ne pas lancer plusieurs réplicas de cette base SQLite.
3. Ajouter ces variables au service :

| Variable | Valeur |
| --- | --- |
| OWNER_EMAIL | Votre email administrateur, en minuscules |
| ADMIN_PASSWORD | Votre mot de passe administrateur privé, entre 12 et 128 caractères |
| APP_URL | Le lien HTTPS public généré par Railway, sans slash final |
| SQLITE_PATH | `/data/casamall.sqlite` |
| ATLAS_API_KEY | Votre clé Atlas privée |

Ne jamais mettre les mots de passe ou clés dans GitHub, les logs ou un message public. Les variables doivent être renseignées dans Railway, pas dans le Dockerfile.

4. Déployer puis Settings → Networking → Generate Domain. Le port est fourni par Railway. Le healthcheck `/api/health` vérifie la base et ses migrations ; il ne valide pas la configuration Atlas ou le mot de passe.
5. Ouvrir le domaine généré et se connecter avec OWNER_EMAIL et ADMIN_PASSWORD. Dans **Équipe**, créer chaque collaboratrice avec son nom, son email et un mot de passe d’au moins 12 caractères. Elle ne voit que ses commandes et sa commission. Le propriétaire peut changer son mot de passe ou suspendre son compte. Aucun email d’invitation n’est envoyé.

Les migrations s’appliquent automatiquement au démarrage sur le volume, jamais pendant le build. Activer les sauvegardes de volume dans Railway. Les coûts et limites dépendent de votre offre Railway ; ne choisissez pas d’abonnement payant sans vérifier son prix.

## Données et sécurité

Cette nouvelle installation n’importe pas automatiquement les commandes, comptes ou paiements de Sites ou Cloudflare D1. Le stock est récupéré dans Atlas avec la clé configurée. Les anciennes données peuvent être migrées séparément avant la bascule.

Les mots de passe des agents sont salés et hachés avec scrypt ; les sessions opaques sont stockées sous forme de hash, expirent après 12 heures et utilisent un cookie HttpOnly, Secure en production, SameSite=Lax. Les changements d’email, de mot de passe ou d’état révoquent les sessions de l’agent. Chaque requête vérifie encore son compte actif et son périmètre. Les mutations contrôlent l’origine ; la connexion limite les tentatives par email et globalement. Le mot de passe propriétaire se change dans les variables Railway. Pour une révocation immédiate de toutes ses sessions, supprimer celles du propriétaire en base lors d’une intervention administrateur.

## Développement

Node.js 24 requis.

```
pnpm install --frozen-lockfile
node --experimental-strip-types --test tests/*.test.mjs
pnpm exec tsc --noEmit
pnpm run build
```

Pour lancer localement, définir OWNER_EMAIL, ADMIN_PASSWORD et SQLITE_PATH sur un fichier local durable, puis `pnpm dev` ou `pnpm start`. Ne pas utiliser une copie de la base de production pour les tests.

La branche main conserve la version Cloudflare. Les corrections WhatsApp et de conservation du prix sont incluses dans cette branche Railway.
