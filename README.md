# Explosada 7.0 · inscription

Page d'inscription pour le réveillon : infos, allergies, règles à accepter, équipes, activités. Une fois la maison réservée, elle affiche aussi le montant à payer et comment payer. Elle n'encaisse rien : aucun moyen de paiement n'est saisi sur la page.

Page statique (HTML, CSS, JS sans build), données dans une Google Sheet privée via Apps Script.

## Deux questionnaires

1. **Celui-ci** : prénom, nom, téléphone, Insta (obligatoire), puis le deal (les 7 règles à glisser, une carte piège et une question à la fin). Ensuite l'écran de la fiche, qui montre le montant et le lien pour payer quand Julien les met dans `Réglages`. Un lien `https://…` écrit dans « Comment payer » devient cliquable.
2. **Le suivant** (la venue, la bouffe, les activités) : le script accepte déjà ces blocs sur la même fiche, mais la page ne les pose plus. La version complète est dans `../sauvegardes/questionnaire-v1-complet-2026-11-07/`.

## Mettre en route

1. Créer une Google Sheet **à part** de celle des lieux.
2. Extensions > Apps Script, coller `apps-script/Code.gs`, enregistrer.
3. Lancer `creerLienDePartage` : les onglets `Inscriptions` et `Réglages` se créent, et le lien à envoyer dans le groupe s'affiche dans le journal d'exécution.
4. Déployer > Nouveau déploiement > Application web (exécuter en tant que : moi, accès : tout le monde). Copier l'URL qui finit par `/exec` dans `config.js` (`API_URL`).
5. Pousser sur GitHub : la page se met à jour toute seule.

Quand le script change : Déployer > Gérer les déploiements > crayon > Nouvelle version. Sans ça, l'ancienne version continue de répondre.

## Comment ça marche

- **Statuts** : `reçue` -> `à payer` -> `payée` (ou `annulée`), à changer à la main dans la colonne B de l'onglet `Inscriptions`. Une place n'est validée qu'une fois payée : `à payer` montre le montant et comment payer.
- **Paiement** : dans l'onglet `Réglages`, remplir « Montant par personne », passer « Paiement ouvert » à `oui` et écrire la consigne. Chaque inscrit **validé** voit alors son montant et la consigne sur sa page. Un inscrit non validé ne voit rien.
- **Équipes** : 6 couleurs (rouge, bleu, vert, jaune, orange, violet), pas de choix côté inscrit. Julien met la couleur de chacun dans la colonne « Équipe (à remplir) » de l'onglet `Inscriptions`, et écrit le planning (qui fait quoi quel jour) dans la ligne « Planning des équipes » de `Réglages`. Chaque inscrit qui a une couleur voit son équipe et ce planning sur sa page.
- **Fermer** les inscriptions : « Inscriptions ouvertes » à `non` (les gens déjà inscrits gardent accès à leur fiche). `fermerLaPage()` coupe tout.
- **Lien qui a fuité** : `changerLienDePartage()`, l'ancien cesse de marcher.
- Chaque inscrit garde un jeton, fabriqué sur son téléphone avant l'envoi (un renvoi après une réponse perdue retombe sur la même fiche) : il ne peut lire et modifier que sa propre fiche. La page ne reçoit jamais la liste des inscrits, ni les allergies ou numéros des autres.
- Sans `API_URL`, la page tourne en mode essai : rien n'est envoyé, tout reste sur le téléphone.

## Données

Allergies et numéros de téléphone sont des données personnelles : ils vivent dans la Sheet privée, jamais dans ce dépôt (public). Ne jamais commiter d'export de la Sheet.

## Tests

`node ../outils/questionnaire-script.test.js` rejoue le script Apps Script sur une Sheet simulée (refus, doublons, jeton, paiement, limites).
