/**
 * @OnlyCurrentDoc
 * Explosada 7.0 — inscriptions.
 * À coller dans une Google Sheet À PART de celle des lieux : Extensions > Apps Script, puis
 * Déployer > Application Web (Exécuter en tant que : moi · Qui a accès : tout le monde).
 * @OnlyCurrentDoc limite le script à cette seule Sheet. Les onglets Inscriptions et Réglages se créent tout seuls.
 *
 * Accès : rien ne répond sans la clé du lien de partage. Chaque inscrit reçoit un jeton personnel
 * (gardé sur son téléphone) : c'est lui qui permet de revoir et de modifier SA fiche, et rien d'autre.
 * La page ne reçoit jamais la fiche d'un autre (allergies, téléphone) ni la liste des inscrits.
 * - creerLienDePartage() : affiche le lien dans le journal d'exécution.
 * - changerLienDePartage() : si le lien a fuité, l'ancien cesse de marcher.
 * - fermerLaPage() / rouvrirLaPage() : coupe tout d'un coup, sans rien effacer.
 * Les statuts (reçue, à payer, payée, annulée) se changent à la main dans la colonne B de l'onglet Inscriptions.
 * Une place n'est validée qu'une fois payée : « à payer » montre le montant et comment payer.
 */

const PAGE = "https://julienrabault.github.io/explosada-inscription/";
const INSCRIPTIONS = "Inscriptions";
const REGLAGES = "Réglages";
const MAX_INSCRITS = 60;
const PAR_MINUTE_CREATIONS = 15;
const PAR_MINUTE_JETON = 20;
const PAR_MINUTE_TOUS = 120;
const CLE_PROP = "CLE";
const VERSION_REGLES = 3; // v3 : les 7 règles du cahier des charges (paiement sous 48 h, +1, équipes, casse, musique, respect, on kiffe)

const STATUTS = ["reçue", "à payer", "payée", "annulée"];
const NUITS = ["31 déc. → 1er janv.", "1er → 2 janv.", "2 → 3 janv."];
const ARRIVEES = ["Le 31 l'après-midi", "Le 31 en soirée", "Le 1er janvier"];
const TRANSPORTS = ["J'ai une voiture", "Je cherche une place en voiture", "Je me débrouille"];
const REGIMES = ["Végétarien", "Végan", "Sans porc", "Halal", "Sans gluten", "Sans lactose"];
const APPETITS = ["Petit", "Normal", "Gros"];
const ALCOOLS = ["Je bois pas", "Un peu", "Normal", "Pas mal"];
const BOISSONS = ["Bière", "Vin", "Alcool fort, cocktails", "Champagne"];
// Les équipes ne se choisissent pas : Julien met une couleur à chacun dans la Sheet, et elles tournent sur les tâches.
const COULEURS = ["Rouge", "Bleu", "Vert", "Jaune", "Orange", "Violet"];
const MIXER = ["Oui", "Non"];
const NB_REGLES = 7;

const COLS = [
  ["date", "Reçue le", 16],
  ["statut", "Statut", 11],
  ["prenom", "Prénom", 14],
  ["nom", "Nom", 16],
  ["tel", "Téléphone", 15],
  ["insta", "Insta", 16],
  ["nuits", "Nuits", 30],
  ["arrivee", "Arrivée", 20],
  ["transport", "Transport", 26],
  ["places", "Places libres", 9],
  ["depart", "Part de", 16],
  ["allergies", "Allergies", 30],
  ["pasManger", "Mange pas", 24],
  ["regime", "Régime", 22],
  ["appetit", "Appétit", 9],
  ["alcool", "Alcool", 11],
  ["boissons", "Boit plutôt", 24],
  ["regles", "Règles", 22],
  ["couleur", "Équipe (à remplir)", 12],
  ["atouts", "Sait bien faire", 26],
  ["pasFaire", "Préfère pas faire", 26],
  ["activite", "Activité proposée", 36],
  ["mixer", "Veut mixer", 10],
  ["son", "Ce qu'il passe", 22],
  ["creneau", "Quand", 16],
  ["mot", "Mot libre", 36],
  ["jeton", "Jeton (ne pas toucher)", 12],
  ["maj", "Modifiée le", 16],
];
const REGLAGES_LIGNES = [
  ["Inscriptions ouvertes (oui / non)", "oui"],
  ["Montant par personne (€)", ""],
  ["Paiement ouvert (oui / non)", "non"],
  ["Comment payer (montré aux inscrits validés)", ""],
  ["Planning des équipes (montré à ceux qui ont une couleur)", ""],
];

/* ---------- entrées ---------- */

function doGet(e) {
  if (!cleValide(e && e.parameter && e.parameter.k)) return json({ error: refus() });
  try {
    return json({ ouvert: inscriptionsOuvertes(), inscrits: nbInscrits() });
  } catch (err) {
    console.error(err);
    return json({ error: "Erreur, réessaie" });
  }
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return json({ error: "Requête illisible" });
  }
  if (!cleValide(req && req.k)) return json({ error: refus() });
  const lock = LockService.getScriptLock();
  let verrou = false;
  try {
    const jeton = typeof req.jeton === "string" && /^[\w-]{8,64}$/.test(req.jeton) ? req.jeton : "";
    limiter(jeton);
    const actions = { inscrire: inscrire, moi: moi };
    if (!Object.prototype.hasOwnProperty.call(actions, req.action)) throw oups("Action inconnue");
    // une seule écriture à la fois : deux envois en même temps ne se marchent pas dessus
    lock.waitLock(15000);
    verrou = true;
    return json(actions[req.action](req, jeton));
  } catch (err) {
    console.error(err);
    return json(err && err.pourLaPage ? (err.code ? { error: err.message, code: err.code } : { error: err.message }) : { error: "Erreur, réessaie" });
  } finally {
    if (verrou) lock.releaseLock();
  }
}

/* ---------- accès ---------- */

function cleValide(k) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty("FERME") !== "oui" && typeof k === "string" && !!k && k === props.getProperty(CLE_PROP);
}

function refus() {
  return PropertiesService.getScriptProperties().getProperty("FERME") === "oui" ? "Page fermée" : "Lien invalide";
}

// un plafond par jeton (un téléphone qui boucle) et un plafond pour tous ; sans jeton, c'est la première
// inscription de chacun : seul le plafond commun s'applique, sinon 40 amis cliquant ensemble se bloqueraient
// peu de nouvelles inscriptions par minute : un lien qui fuite ne remplit pas la liste d'un coup
function creations() {
  const cache = CacheService.getScriptCache();
  const cle = "cr:" + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(cle) || 0) + 1;
  if (n > PAR_MINUTE_CREATIONS) throw oups("Beaucoup d'inscriptions en même temps, réessaie dans une minute");
  cache.put(cle, String(n), 120);
}

function limiter(jeton) {
  const cache = CacheService.getScriptCache();
  const minute = Math.floor(Date.now() / 60000);
  const plafonds = [["rl:*:" + minute, PAR_MINUTE_TOUS]];
  if (jeton) plafonds.push(["rl:" + jeton + ":" + minute, PAR_MINUTE_JETON]);
  plafonds.forEach(([cle, max]) => {
    const n = Number(cache.get(cle) || 0) + 1;
    if (n > max) throw oups("Trop de requêtes, attends une minute");
    cache.put(cle, String(n), 120);
  });
}

function creerLienDePartage() {
  feuille(INSCRIPTIONS); // les onglets se créent ici, pas pendant les premières ouvertures de la page
  feuille(REGLAGES);
  console.log("Lien à envoyer au groupe : " + PAGE + "?k=" + cle());
}

function changerLienDePartage() {
  PropertiesService.getScriptProperties().deleteProperty(CLE_PROP);
  creerLienDePartage();
}

function cle() {
  const props = PropertiesService.getScriptProperties();
  let valeur = props.getProperty(CLE_PROP);
  if (!valeur) {
    valeur = Utilities.getUuid().replace(/-/g, "");
    props.setProperty(CLE_PROP, valeur);
  }
  return valeur;
}

function fermerLaPage() {
  PropertiesService.getScriptProperties().setProperty("FERME", "oui");
}

function rouvrirLaPage() {
  PropertiesService.getScriptProperties().deleteProperty("FERME");
}

/* ---------- actions ---------- */

function inscrire(req, jeton) {
  const f = champs(req);
  const sh = feuille(INSCRIPTIONS);
  const data = lignes(sh);
  const iJeton = colIndex("jeton"), iPrenom = colIndex("prenom"), iNom = colIndex("nom"), iStatut = colIndex("statut");
  const i = jeton ? data.findIndex(r => String(r[iJeton]) === jeton) : -1;
  if (i >= 0) {
    const statut = String(data[i][iStatut]);
    if (statut === "payée" || statut === "annulée") throw oups("Ton inscription est déjà " + statut + ", écris-moi pour la changer");
    if (data.some((r, n) => n !== i && memeNom(r[iPrenom], f.prenom) && memeNom(r[iNom], f.nom))) throw oups("Il y a déjà une inscription à ce nom");
    // l'accord sur les règles garde sa date tant que les règles n'ont pas changé
    const gardeRegles = String(data[i][colIndex("regles")]).includes(" v" + VERSION_REGLES + " ");
    // un champ que ce questionnaire n'envoie pas (la venue, la bouffe... viennent plus tard) garde sa valeur
    const garde = (k, j) => k === "date" || k === "statut" || k === "jeton" || k === "couleur" || (k === "regles" && gardeRegles) || (k !== "maj" && f[k] === undefined);
    const ligne = COLS.map(([k], j) => (garde(k, j) ? data[i][j] : k === "maj" ? new Date() : f[k]));
    sh.getRange(i + 2, 1, 1, COLS.length).setValues([ligne]);
    return { moi: vue(ligne), jeton };
  }
  if (!inscriptionsOuvertes()) throw oups("Les inscriptions sont fermées");
  if (data.some(r => memeNom(r[iPrenom], f.prenom) && memeNom(r[iNom], f.nom))) {
    throw oups("Il y a déjà une inscription à ce nom. Si c'est toi sur un autre téléphone, dis-le moi et je te débloque");
  }
  if (data.filter(r => r[iPrenom]).length >= MAX_INSCRITS) throw oups("Les inscriptions sont pleines");
  creations();
  // le téléphone fabrique son jeton avant d'envoyer : si la réponse se perd, le renvoi retombe sur la même fiche
  const nouveau = /^[\w-]{32,64}$/.test(jeton) ? jeton : Utilities.getUuid().replace(/-/g, "");
  const ligne = COLS.map(([k]) => (k === "date" || k === "maj" ? new Date() : k === "statut" ? "reçue" : k === "jeton" ? nouveau : k === "couleur" || f[k] === undefined ? "" : f[k]));
  sh.appendRow(ligne);
  return { moi: vue(ligne), jeton: nouveau };
}

function moi(req, jeton) {
  if (!jeton) throw oups("Pas d'inscription sur ce téléphone");
  const sh = feuille(INSCRIPTIONS);
  const iJeton = colIndex("jeton");
  const ligne = lignes(sh).find(r => String(r[iJeton]) === jeton);
  if (!ligne) throw oups("Inscription introuvable", "jeton");
  return { moi: vue(ligne), jeton };
}

/* ---------- validation ---------- */

function champs(req) {
  const regles = req.regles;
  if (!Array.isArray(regles) || regles.length !== NB_REGLES || !regles.every(x => x === true)) throw oups("Il faut cocher toutes les règles");
  const tel = String(req.tel == null ? "" : req.tel).trim();
  if (!/^[+\d][\d .()-]{5,24}$/.test(tel)) throw oups("Ton numéro n'a pas l'air bon");
  const f = {
    prenom: nomPropre(req.prenom, "Il faut ton prénom", 30),
    nom: nomPropre(req.nom, "Il faut ton nom", 40),
    tel,
    insta: pseudo(req.insta),
    regles: NB_REGLES + "/" + NB_REGLES + " acceptées v" + VERSION_REGLES + " le " + Utilities.formatDate(new Date(), "Europe/Paris", "dd/MM HH:mm"),
  };
  // trois blocs viennent avec le 2e questionnaire : absents, ils restent vides ; envoyés, ils sont vérifiés en entier
  if (req.nuits !== undefined) Object.assign(f, venue(req));
  if (req.appetit !== undefined) Object.assign(f, bouffe(req));
  if (req.mixer !== undefined) Object.assign(f, extras(req));
  return f;
}

function venue(req) {
  // deux nuits d'affilée au moins : pas de passage pour une soirée, pas de 31 puis retour le 2
  const nuits = liste(req.nuits, NUITS, 2, 3, "Deux nuits d'affilée minimum");
  if (nuits.length === 2 && nuits[0] === NUITS[0] && nuits[1] === NUITS[2]) throw oups("Deux nuits d'affilée minimum");
  const arrivee = choix(req.arrivee, ARRIVEES, "Dis quand tu arrives");
  if ((arrivee === ARRIVEES[2]) === nuits.includes(NUITS[0])) throw oups("Ton arrivée colle pas avec tes nuits");
  const transport = choix(req.transport, TRANSPORTS, "Dis comment tu viens");
  const voiture = transport === TRANSPORTS[0];
  const places = voiture ? Math.round(Number(req.places)) : "";
  if (voiture && !(places >= 0 && places <= 8)) throw oups("Entre 0 et 8 places libres");
  return { nuits: nuits.join(" · "), arrivee, transport, places, depart: texte(req.depart, 60) };
}

function bouffe(req) {
  const alcool = choix(req.alcool, ALCOOLS, "Dis-moi côté alcool");
  return {
    allergies: texte(req.allergies, 300),
    pasManger: texte(req.pasManger, 200),
    regime: liste(req.regime, REGIMES, 0, REGIMES.length, "Régime inconnu").join(" · "),
    appetit: choix(req.appetit, APPETITS, "Dis-moi ton appétit"),
    alcool,
    boissons: alcool === ALCOOLS[0] ? "" : liste(req.boissons, BOISSONS, 0, BOISSONS.length, "Boisson inconnue").join(" · "),
  };
}

function extras(req) {
  const mixer = choix(req.mixer, MIXER, "Dis si tu veux mixer");
  return {
    atouts: texte(req.atouts, 200),
    pasFaire: texte(req.pasFaire, 200),
    activite: texte(req.activite, 300),
    mixer,
    son: mixer === "Oui" ? texte(req.son, 100) : "",
    creneau: mixer === "Oui" ? texte(req.creneau, 60) : "",
    mot: texte(req.mot, 500),
  };
}

// l'Insta est obligatoire : un pseudo, rangé avec son @
function pseudo(v) {
  const s = String(v == null ? "" : v).trim().replace(/^@+/, "");
  if (!s) throw oups("Il faut ton Insta");
  if (!/^[\w.]{1,30}$/.test(s)) throw oups("Ton Insta n'a pas l'air bon");
  return "@" + s;
}

function liste(v, permis, min, max, message) {
  if (!Array.isArray(v)) throw oups(message);
  const vus = [];
  v.forEach(x => {
    if (!permis.includes(x)) throw oups(message);
    if (!vus.includes(x)) vus.push(x);
  });
  if (vus.length < min || vus.length > max) throw oups(message);
  return permis.filter(x => vus.includes(x));
}

function choix(v, permis, message) {
  if (!permis.includes(v)) throw oups(message);
  return v;
}

function nomPropre(v, message, max) {
  const s = String(v == null ? "" : v).trim().replace(/\s+/g, " ");
  if (!/^\p{L}[\p{L}'’ .-]*$/u.test(s) || s.length > max) throw oups(message);
  return s;
}

/* ---------- ce que la page a le droit de voir : SA fiche, rien d'autre ---------- */

function vue(r) {
  const o = {};
  COLS.forEach(([k], i) => (o[k] = r[i] instanceof Date ? r[i].getTime() : typeof r[i] === "string" ? sansApostrophe(r[i]) : r[i]));
  const statut = STATUTS.includes(o.statut) ? o.statut : "reçue";
  const sert = oui(2) && statut === "à payer";
  const montant = Number(reglage(1));
  return {
    statut,
    prenom: o.prenom, nom: o.nom, tel: o.tel, insta: o.insta,
    nuits: o.nuits ? String(o.nuits).split(" · ") : [],
    arrivee: o.arrivee, transport: o.transport, places: o.places, depart: o.depart,
    allergies: o.allergies, pasManger: o.pasManger, regime: o.regime ? String(o.regime).split(" · ") : [],
    appetit: o.appetit, alcool: o.alcool, boissons: o.boissons ? String(o.boissons).split(" · ") : [],
    couleur: COULEURS.includes(o.couleur) ? o.couleur : "",
    planning: COULEURS.includes(o.couleur) ? sansApostrophe(reglage(4)) : "",
    atouts: o.atouts, pasFaire: o.pasFaire, activite: o.activite, mixer: o.mixer, son: o.son, creneau: o.creneau, mot: o.mot,
    montant: Number.isFinite(montant) && montant > 0 && (sert || statut === "payée") ? montant : null,
    payer: sert ? sansApostrophe(reglage(3)) : "",
  };
}

/* ---------- outils ---------- */

function reglage(i) {
  const v = feuille(REGLAGES).getRange(2 + i, 2).getValue();
  return v == null ? "" : String(v).trim();
}

const oui = i => reglage(i).toLowerCase() === "oui";
// « Inscriptions ouvertes » : tout sauf un « non » écrit explicitement, pour qu'une case vidée ne ferme pas la page
const inscriptionsOuvertes = () => reglage(0).toLowerCase() !== "non";

function nbInscrits() {
  const iStatut = colIndex("statut");
  const iPrenom = colIndex("prenom");
  return lignes(feuille(INSCRIPTIONS)).filter(r => r[iPrenom] && r[iStatut] !== "annulée").length;
}

function colIndex(k) {
  return COLS.findIndex(c => c[0] === k);
}

function lignes(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  // toutes les lignes, vides comprises : l'index d'une ligne doit rester son vrai numéro dans la Sheet
  return sh.getRange(2, 1, n, COLS.length).getValues();
}

function feuille(nom) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nom);
  if (sh) return sh;
  sh = ss.insertSheet(nom);
  if (nom === INSCRIPTIONS) {
    sh.getRange(1, 1, 500, COLS.length).setNumberFormat("@"); // texte brut : « 06… » et « 12/05 » restent tels quels
    sh.getRange(1, colIndex("date") + 1, 500, 1).setNumberFormat("dd/mm/yyyy hh:mm");
    sh.getRange(1, colIndex("maj") + 1, 500, 1).setNumberFormat("dd/mm/yyyy hh:mm");
    sh.appendRow(COLS.map(c => c[1]));
    COLS.forEach((c, i) => sh.setColumnWidth(i + 1, c[2] * 9));
    sh.getRange(2, colIndex("statut") + 1, 499, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(STATUTS, true).setAllowInvalid(false).build());
    sh.getRange(2, colIndex("couleur") + 1, 499, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(COULEURS, true).setAllowInvalid(false).build());
    sh.hideColumns(colIndex("jeton") + 1);
  } else {
    sh.getRange(1, 1, 20, 2).setNumberFormat("@");
    sh.appendRow(["Réglage", "Valeur"]);
    REGLAGES_LIGNES.forEach(l => sh.appendRow(l));
    sh.setColumnWidth(1, 330);
    sh.setColumnWidth(2, 420);
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight("bold");
  return sh;
}

function memeNom(a, b) {
  const n = v => sansApostrophe(v).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s'.-]+/g, " ");
  return n(a) === n(b);
}

function sansApostrophe(v) {
  return String(v == null ? "" : v).replace(/^'/, "");
}

function texte(v, max) {
  let s = String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // pas de formule injectée dans la Sheet
  return s;
}

// erreur dont le message peut être montré tel quel sur la page
function oups(message, code) {
  const e = new Error(message);
  e.pourLaPage = true;
  if (code) e.code = code;
  return e;
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
