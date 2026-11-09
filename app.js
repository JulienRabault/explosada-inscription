"use strict";

const $ = id => document.getElementById(id);
// le deal : une carte par règle, en gros, puis la phrase qui l'explique
const REGLES = [
  ["Je m'inscris, je paie", "Avant la fin de la semaine où on réserve. On avance l'argent de la maison : si tu viens pas, c'est nous qui payons. Remboursé seulement si tout le week-end est annulé."],
  ["Pas de +1 surprise", "Tu peux ramener quelqu'un si tu préviens avant. Il paie et il participe comme tout le monde."],
  ["Je fais ma part", "Des équipes, chacune avec un chef. Personne a les pieds sous la table."],
  ["Je casse, je le dis", "Ça arrive, c'est pas grave. Mais la caution, c'est tout le monde qui la paie."],
  ["La musique se coupe vers 4 h", "Pour ceux qui veulent dormir."],
  ["Je respecte les autres et leurs limites", "Non, c'est non."],
  ["On kiffe", "Obligatoire, non négociable."],
];
const LECTURE = 1200; // le temps de lire une carte avant de pouvoir la passer
const CALME = matchMedia("(prefers-reduced-motion: reduce)").matches;
// la couverture : le prix à annoncer pour les 3 nuits si on est 30, et ce qu'il comprend
const PRIX = 275;
const DEDANS = ["La maison", "Tous les repas", "L'alcool", "La musique", "Le DJ", "La déco"];
// la frise des dates : la même sur l'accueil et sur l'écran de fin. « quand » sert à savoir ce qui est passé
const ETAPES = {
  inscriptions: { quand: "2026-11-12", haut: "jeu.", gros: "12", bas: "nov.", titre: "Fin des inscriptions", texte: "Je t'ajoute au groupe des inscrits et je t'envoie comment payer." },
  reservation: { quand: "2026-11-15", haut: "dim.", gros: "15", bas: "nov.", titre: "On réserve la maison", texte: "Paie avant la fin de la semaine : on a bloqué la maison, il faut la réserver." },
  formulaire: { quand: "2026-11-30", haut: "fin", gros: "nov.", titre: "Le deuxième formulaire", texte: "Allergies, régime, trajet, draps." },
  programme: { quand: "2026-12-15", haut: "mi", gros: "déc.", titre: "Le programme", texte: "Les activités, pas obligatoires, et les soirées à thème." },
  jourJ: { quand: "2026-12-31", haut: "jeu.", gros: "31", bas: "déc.", titre: "On y est", texte: "Arrivée le soir, départ le dimanche matin." },
};
const FRISE_COVER = ["inscriptions", "reservation", "jourJ"];
const FRISE_SUITE = ["inscriptions", "reservation", "formulaire", "programme", "jourJ"];

const TEL = /^[+\d][\d .()-]{5,24}$/;
const NOM = /^\p{L}[\p{L}'’ .-]*$/u;
const INSTA = /^[\w.]{1,30}$/;
const DERNIERE = 2;

// la typo française : une espace fine insécable avant « : ; ? ! », et le nombre collé à son unité (275 €, 48 h, 3 nuits).
// Comme ça, aucun deux-points ni aucun « € » ne tombe seul en début de ligne.
function fr(s) {
  return String(s)
    .replace(/ ([:;?!»])/g, "\u202f$1")
    .replace(/« /g, "«\u202f")
    .replace(/(\d) (€|h\b|nuits?\b|min\b|jours?\b|règles?\b)/g, "$1\u00a0$2")
    .replace(/(^|\s)(J|à|de|en|au|la|le|un|une) (\d)/g, "$1$2\u00a0$3");
}
// les textes déjà écrits dans la page passent par la même règle, une fois au démarrage
function typo(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim()) n.nodeValue = fr(n.nodeValue);
}

// les jours jusqu'au réveillon : « J-53 », puis « Demain », « Ce soir », et plus rien une fois passé
function rebours() {
  const auj = new Date(), j = new Date(2026, 11, 31);
  const n = Math.round((j - new Date(auj.getFullYear(), auj.getMonth(), auj.getDate())) / 864e5);
  return n > 1 ? "J-" + n : n === 1 ? "Demain" : n === 0 ? "Ce soir" : "";
}

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false && k !== "") e.append(typeof k === "string" ? fr(k) : k);
  return e;
}
// 349,5 → « 349,50 », 200 → « 200 » : les centimes seulement quand il y en a
function euros(n) {
  const x = Number(n);
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: Number.isInteger(x) ? 0 : 2, maximumFractionDigits: 2 }).format(x);
}

let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = fr(msg);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- le formulaire, en étapes courtes ---------- */

const form = $("form");
let editing = false;
let etape = 0;

const val = name => (form.elements[name] ? form.elements[name].value : "");

function lire() {
  const ok = form.elements["regles-ok"].checked;
  return {
    prenom: val("prenom").trim().replace(/\s+/g, " "), nom: val("nom").trim().replace(/\s+/g, " "), tel: val("tel").trim(),
    insta: val("insta").trim().replace(/^@+/, ""),
    regles: REGLES.map(() => ok),
  };
}

function remplir(d) {
  const set = (name, v) => { if (form.elements[name] && v != null) form.elements[name].value = v; };
  ["prenom", "nom", "tel", "insta"].forEach(k => set(k, d[k]));
  lues = d.regles && d.regles.length && d.regles.every(Boolean) ? TOTAL : 0;
  deck();
}

// premier problème trouvé, avec l'étape où il se corrige
function verifier(d) {
  const bad = (msg, el, step) => ({ msg, el, step });
  const champ = n => form.elements[n].closest(".field");
  if (!d.prenom || d.prenom.length > 30 || !NOM.test(d.prenom)) return bad("Il faut ton prénom", champ("prenom"), 1);
  if (!d.nom || d.nom.length > 40 || !NOM.test(d.nom)) return bad("Il faut ton nom", champ("nom"), 1);
  if (!TEL.test(d.tel)) return bad("Ton numéro n'a pas l'air bon", champ("tel"), 1);
  if (!d.insta) return bad("Il faut ton Insta", champ("insta"), 1);
  if (!INSTA.test(d.insta)) return bad("Ton Insta n'a pas l'air bon", champ("insta"), 1);
  if (d.regles.some(r => !r)) return bad(`Passe les ${REGLES.length} règles pour valider ta place`, $("deck"), 2);
  return null;
}

function marquer(el) {
  form.querySelectorAll(".bad").forEach(e => e.classList.remove("bad"));
  if (!el) return;
  el.classList.add("bad");
  el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

// montre l'étape n : la 0 (accueil) ne sert qu'à une première inscription
function aller(n, defiler = true) {
  const avant = etape;
  form.classList.toggle("fwd", n >= etape);
  form.classList.toggle("bwd", n < etape);
  etape = n;
  form.querySelectorAll(".step").forEach(s => { s.classList.toggle("on", Number(s.dataset.n) === n); });
  document.body.classList.toggle("in-steps", n > 0);
  document.body.classList.toggle("cover", n === 0);
  $("stepbar").hidden = n === 0;
  $("fuse").style.setProperty("--p", n / DERNIERE);
  // une étape passée : la mèche avance, et son étincelle crache une petite gerbe en arrivant
  if (n > avant && n > 0) setTimeout(petard, n === 1 ? 40 : 380);
  $("step-count").textContent = n + " sur " + DERNIERE;
  $("back").textContent = editing && n === 1 ? "Annuler" : "Retour";
  $("send").textContent = n === DERNIERE ? (editing ? "Enregistrer" : "Envoyer") : n === 0 ? "Prendre ma place" : "Suivant";
  $("send-foot").hidden = n !== DERNIERE || editing;
  $("msg").textContent = "";
  marquer(null);
  if (n === 2) deck(); // le prénom du tampon a pu changer, et la carte du dessus repart pour un temps de lecture
  if (defiler) window.scrollTo(0, 0);
}

/* ---------- le deal : les règles une par une, à glisser à droite ---------- */

// pour ceux qui glissent sans lire : une carte piège après la 3e règle, et une question à la fin.
// Tomber dedans renvoie à la première carte.
const PIEGE_APRES = 3;
const FAUSSES = ["On dort pas avant 4h", "Je ramène ma bouffe", "Le dernier levé fait la vaisselle", "Pas de chaussures dans la maison"];
const TOTAL = REGLES.length + 2;
const melanger = l => l.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

// la question change à chaque tour : une règle au hasard, sa vraie réponse et deux fausses
function nouveauQuiz() {
  const i = Math.floor(Math.random() * REGLES.length);
  return { titre: `La règle ${i + 1}, c'était quoi ?`, bonne: REGLES[i][0], choix: melanger([REGLES[i][0], ...melanger(FAUSSES).slice(0, 2)]) };
}

let lues = 0, montreeA = 0, quiz = nouveauQuiz();

function pile() {
  const regles = REGLES.map(([titre, texte], i) => ({ type: "regle", n: `Règle ${i + 1} sur ${REGLES.length}`, titre, texte }));
  const piege = { type: "piege", n: `Règle ${PIEGE_APRES} bis`, titre: "Je suis con, j'accepte", texte: "C'est juste pour voir si tu suis. Celle-là, glisse-la à gauche." };
  return [...regles.slice(0, PIEGE_APRES), piege, ...regles.slice(PIEGE_APRES), { type: "quiz", n: "Dernière question", ...quiz }];
}

const haut = () => $("deck").querySelector('.card[data-pos="0"]');

function deck() {
  const box = $("deck"), cartes = pile(), fini = lues >= TOTAL;
  form.elements["regles-ok"].checked = fini;
  // toutes les cartes restent dans la pile, même passées (invisibles) : elle garde la hauteur
  // de la plus grande, et rien ne bouge en dessous d'une carte à l'autre
  box.replaceChildren(...[...cartes.map((c, k) => carte(c, k - lues)), fini ? signe() : null].filter(Boolean));
  $("deck-msg").textContent = fini ? "" : cartes[lues].type === "quiz" ? "Une seule bonne réponse." : "Glisse à droite, ou appuie sur Ok.";
  if (fini) return;
  montreeA = performance.now();
  if (cartes[lues].type !== "quiz") glisser(haut(), cartes[lues].type === "piege");
}

function carte(c, pos) {
  const quizz = c.type === "quiz";
  return h("div", { class: "card card-" + c.type, "data-pos": pos === 0 || pos === 1 || pos === 2 ? String(pos) : "x", "aria-hidden": pos ? "true" : null },
    h("p", { class: "card-n" }, c.n),
    h("h3", { class: "card-t" }, c.titre),
    c.texte ? h("p", { class: "card-x" }, c.texte) : null,
    quizz
      ? h("div", { class: "card-quiz" }, c.choix.map(t => h("button", { type: "button", class: "btn", onclick: () => repondre(t) }, t)))
      : h("div", { class: "card-act" },
        h("button", { type: "button", class: "btn card-no", onclick: () => refuser() }, "Non"),
        h("button", { type: "button", class: "btn card-ok", onclick: () => accepter() }, "Ok, ça marche")),
    quizz ? null : h("span", { class: "card-bar", "aria-hidden": "true" }),
    quizz ? null : h("span", { class: "card-stamp", "aria-hidden": "true" }, "Ok"));
}

function signe() {
  const prenom = val("prenom").trim();
  return h("div", { class: "signed" },
    h("p", { class: "signed-k" }, "Le deal"),
    h("p", { class: "signed-stamp" }, "Signé"),
    h("p", { class: "signed-who" }, (prenom ? prenom + " · " : "") + REGLES.length + " règles sur " + REGLES.length),
    h("details", { class: "signed-list" }, h("summary", null, "Relire les règles"),
      h("ol", null, REGLES.map(([t, x]) => h("li", null, h("b", null, t), " " + x)))));
}

function remettre(carte) {
  carte.style.transition = "transform .35s var(--ease-out)";
  carte.style.transform = "";
  carte.style.setProperty("--ok", 0);
}

// trop vite, ou glissée à gauche : la carte revient et secoue la tête
function relire(carte, msg) {
  remettre(carte);
  carte.classList.remove("non");
  void carte.offsetWidth;
  carte.classList.add("non");
  $("deck-msg").textContent = fr(msg);
}

// la carte du dessus peut partir : elle est là, pas déjà en vol (double appui), et lue assez longtemps
function prete(carte) {
  if (!carte || carte.classList.contains("part")) return false;
  if (performance.now() - montreeA < LECTURE) { relire(carte, "Hop, lis-la d'abord"); return false; }
  return true;
}

function accepter(dx = 0) {
  const carte = haut();
  if (!prete(carte)) return;
  if (carte.classList.contains("card-piege")) return piege(carte);
  sortir(carte, 1, dx);
}

// « Non » : refusé pour une vraie règle, et c'est la bonne réponse pour le piège
function refuser(dx = 0) {
  const carte = haut();
  if (!prete(carte)) return;
  if (!carte.classList.contains("card-piege")) return relire(carte, "Pas le choix, c'est le deal");
  sortir(carte, -1, dx);
}

function sortir(carte, sens, dx) {
  carte.classList.add("part");
  const suite = () => {
    lues++;
    deck();
    if (lues < TOTAL) return;
    // signé : le reproche d'avant n'a plus lieu d'être
    if ($("deck").classList.contains("bad")) { marquer(null); $("msg").textContent = ""; }
    tamponner();
  };
  if (CALME) return suite();
  carte.style.transition = "transform .3s var(--ease-out), opacity .3s var(--ease-out)";
  carte.style.transform = `translateX(${sens * (Math.abs(dx) + carte.offsetWidth)}px) rotate(${sens * 16}deg)`;
  carte.style.opacity = "0";
  setTimeout(suite, 200);
}

function recommencer(msg) {
  lues = 0;
  quiz = nouveauQuiz();
  deck();
  $("deck-msg").textContent = fr(msg);
}

// tombé dans le piège : la carte secoue la tête, puis on repart de la première règle
function piege(carte) {
  carte.classList.add("part");
  relire(carte, "Raté, t'as pas lu. On reprend du début.");
  setTimeout(() => recommencer("Raté, t'as pas lu. On reprend du début."), 1300);
}

function repondre(choix) {
  const carte = haut();
  if (!carte || carte.classList.contains("part")) return;
  if (choix === quiz.bonne) return sortir(carte, 1, 0);
  recommencer(`Raté, c'était « ${quiz.bonne} ». On reprend du début.`);
}

// le doigt tient la carte là où il l'a prise ; à droite elle part, à gauche elle résiste (pas le choix),
// sauf le piège, qui se glisse librement des deux côtés
function glisser(carte, libre) {
  let x0 = 0, dx = 0, id = null, trace = [];
  carte.addEventListener("pointerdown", e => {
    if (e.target.closest("button") || id !== null || carte.classList.contains("part")) return;
    id = e.pointerId;
    x0 = e.clientX;
    dx = 0;
    trace = [[e.clientX, e.timeStamp]];
    carte.setPointerCapture(id);
    carte.style.transition = "none";
  });
  carte.addEventListener("pointermove", e => {
    if (e.pointerId !== id) return;
    const brut = e.clientX - x0;
    dx = brut > 0 || libre ? brut : brut * .3;
    trace = [...trace.slice(-4), [e.clientX, e.timeStamp]];
    carte.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
    carte.style.setProperty("--ok", Math.min(1, Math.max(0, dx / 110)));
  });
  const lacher = e => {
    if (e.pointerId !== id) return;
    id = null;
    const [xa, ta] = trace[0], [xb, tb] = trace[trace.length - 1];
    const v = tb > ta ? (xb - xa) / (tb - ta) : 0; // px par ms : un petit jeté suffit
    if (dx > carte.offsetWidth * .35 || (v > .5 && dx > 30)) return accepter(dx);
    if (libre ? dx < -carte.offsetWidth * .35 || (v < -.5 && dx < -30) : dx < -24) return refuser(dx);
    remettre(carte);
  };
  carte.addEventListener("pointerup", lacher);
  carte.addEventListener("pointercancel", lacher);
}

function tamponner() {
  const s = $("deck").querySelector(".signed-stamp");
  if (!s) return;
  const r = s.getBoundingClientRect();
  fx.fire(r.left + r.width / 2, r.top + r.height / 2, 46, null, 160);
}

/* ---------- les feux : le ciel du titre, et un calque pour les moments forts ---------- */

let fx = { fire() {} };

function petard() {
  if ($("stepbar").hidden) return;
  const s = document.querySelector(".fuse-spark").getBoundingClientRect();
  fx.fire(s.left + s.width / 2, s.top + s.height / 2, 26);
}

// l'arrivée : trois gerbes au-dessus du titre, l'une après l'autre, pendant que l'affiche monte. Une seule fois.
function salve() {
  if (!document.body.classList.contains("cover")) return;
  const t = document.querySelector(".top h1").getBoundingClientRect(), W = innerWidth;
  const haut = Math.max(70, t.top * .55), R = Math.min(W, 520);
  [[.3, .95, 0], [.74, .7, 260], [.52, 1.15, 560]].forEach(([x, y, d]) => fx.fire(W * x, haut * y, R * .2, null, 380 + d));
}

// le bouquet final, une seule fois : quand l'inscription vient de partir
function bouquet() {
  const W = innerWidth, H = innerHeight, R = Math.min(W, 560);
  for (let i = 0; i < 8; i++) {
    fx.fire(W * (.14 + Math.random() * .72), H * (.1 + Math.random() * .42), R * (.13 + Math.random() * .11), null, i * 240 + Math.random() * 140);
  }
}

let saveTimer = 0;
function garder() {
  if (editing || form.hidden) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // le brouillon ne garde pas l'accord sur les règles : on le donne à chaque fois, en connaissance de cause
    brouillon.save({ ...lire(), regles: [] });
  }, 400);
}

async function suite(e) {
  e.preventDefault();
  if (etape < DERNIERE) {
    const pb = etape === 0 ? null : verifier(lire());
    if (pb && pb.step <= etape) {
      $("msg").textContent = pb.msg;
      marquer(pb.el);
      return;
    }
    return aller(etape + 1);
  }
  const d = lire();
  const pb = verifier(d);
  if (pb) {
    aller(pb.step, false);
    $("msg").textContent = pb.msg;
    marquer(pb.el);
    return;
  }
  const btn = $("send");
  btn.disabled = true;
  btn.textContent = "Envoi…";
  try {
    jeton.ensure();
    const res = await db.post({ action: "inscrire", ...d });
    if (res.jeton) jeton.set(res.jeton);
    clearTimeout(saveTimer); // un enregistrement du brouillon encore en attente le ramènerait
    brouillon.clear();
    const premiere = !editing;
    editing = false;
    montrerStatut(res.moi, true);
    window.scrollTo(0, 0);
    if (premiere) bouquet();
  } catch (err) {
    $("msg").textContent = err.server ? err.message : "Pas de réseau ou le script répond pas. Tes réponses sont gardées, réessaie.";
  } finally {
    btn.disabled = false;
    btn.textContent = editing ? "Enregistrer" : "Envoyer";
  }
}

/* ---------- les écrans ---------- */

const ECRANS = ["loading", "closed", "problem", "status", "form"];
function montrer(nom) {
  ECRANS.forEach(e => { $(e).hidden = e !== nom; });
  if (nom !== "form") document.body.classList.remove("in-steps", "cover");
}

const STATUTS_TXT = {
  // une place n'est validée qu'une fois payée : avant, c'est reçu, puis à payer
  reçue: { pill: "Reçue", couleur: "orange", titre: "C'est bon, c'est reçu", texte: "Ta place est validée quand c'est payé. Jeudi soir, je t'envoie comment faire." },
  "à payer": { pill: "À payer", couleur: "orange", titre: "Plus qu'à payer", texte: "Je t'envoie le montant et comment payer. Ta place est validée quand c'est payé." },
  payée: { pill: "Validée", couleur: "green", titre: "C'est payé, ta place est validée", texte: "Y a plus rien à faire de ton côté." },
  annulée: { pill: "Annulée", couleur: "gray", titre: "Ton inscription est annulée", texte: "Si c'est pas normal, écris-moi." },
};

// le texte « comment payer » est écrit par Julien : un lien https y devient cliquable, rien d'autre ne l'est
function liens(el, texte) {
  const morceaux = String(texte).split(/(https:\/\/[^\s]+)/);
  el.replaceChildren(...morceaux.map((m, i) => {
    if (i % 2 === 0) return m;
    try { return h("a", { href: new URL(m).href, target: "_blank", rel: "noopener noreferrer" }, m.replace(/^https:\/\//, "")); } catch (e) { return m; }
  }));
}

function ligne(nom, v) {
  return v ? h("div", { class: "recap-row" }, h("dt", null, nom), h("dd", null, v)) : null;
}

let fiche = null;
function montrerStatut(moi, envoyee) {
  fiche = moi;
  const t = STATUTS_TXT[moi.statut] || STATUTS_TXT["reçue"];
  // le billet : le prénom en grand, puis le nom et le nombre de nuits
  $("ticket-name").textContent = moi.prenom || "";
  $("ticket-meta").textContent = moi.nom || "";
  const pill = $("status-pill");
  pill.textContent = t.pill;
  pill.className = "pill " + t.couleur;
  $("status-title").textContent = fr(t.titre);
  const paye = moi.statut === "à payer" && moi.montant && moi.payer;
  $("status-text").textContent = fr(paye ? "Ta part est juste en dessous. Ta place est validée dès que je l'ai reçue." : t.texte);

  $("pay").hidden = !paye;
  if (paye) {
    $("pay-amount").textContent = euros(moi.montant);
    liens($("pay-how"), moi.payer);
  }

  // l'équipe est donnée par Julien : tant qu'il n'a rien mis, la page n'en parle pas
  const equipe = $("team");
  equipe.hidden = !moi.couleur;
  if (moi.couleur) {
    $("team-name").textContent = moi.couleur;
    equipe.dataset.couleur = moi.couleur;
    $("team-plan").textContent = moi.planning || "Le planning arrive.";
  }

  $("recap").replaceChildren(h("h2", { class: "sec-h" }, "Ce que t'as répondu"), h("dl", { class: "group" },
    ligne("Nom", [moi.prenom, moi.nom].filter(Boolean).join(" ")),
    ligne("Téléphone", moi.tel),
    ligne("Insta", moi.insta ? "@" + moi.insta.replace(/^@+/, "") : ""),
    ligne("Le deal", REGLES.length + " règles, signées")));
  $("edit-group").hidden = moi.statut === "payée" || moi.statut === "annulée";
  $("edit").onclick = () => editer(moi);
  $("share").onclick = partager;
  montrer("status");
  if (envoyee) toast("Envoyé");
}

// le lien du groupe, sans le jeton perso (il vit dans le téléphone, pas dans l'adresse)
async function partager() {
  const url = location.origin + location.pathname + location.search;
  const texte = "Le réveillon Explosada, du 31 au 3 janvier. Inscris-toi là :";
  if (navigator.share) {
    try { await navigator.share({ title: "Explosada 7.0", text: texte, url }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(texte + " " + url); toast("Lien copié"); }
  catch (e) { toast("Copie le lien en haut de la page"); }
}

// une étape est passée le lendemain de sa date ; la première qui ne l'est pas s'allume
function frise(el, cles) {
  const auj = new Date();
  let prochaine = true;
  el.replaceChildren(...cles.map(c => {
    const e = ETAPES[c];
    const passee = auj >= new Date(e.quand + "T23:59:59");
    const etat = passee ? "passee" : prochaine ? "prochaine" : "";
    if (!passee) prochaine = false;
    return h("li", { class: etat || null },
      h("span", { class: "cal", "aria-hidden": "true" }, h("span", { class: "cal-h" }, e.haut), h("span", { class: "cal-g" }, e.gros), e.bas ? h("span", { class: "cal-b" }, e.bas) : null),
      h("span", { class: "frise-txt" }, h("span", { class: "frise-t" }, e.titre), h("span", { class: "frise-x" }, e.texte)));
  }));
}

function editer(moi) {
  editing = true;
  form.reset();
  remplir({ ...moi, regles: REGLES.map(() => true) });
  montrer("form");
  etape = 0;
  aller(1);
}

// en modification, revenir avant la première étape ramène à sa fiche, sans rien changer
function retour() {
  if (!(editing && etape === 1)) return aller(etape - 1);
  editing = false;
  montrerStatut(fiche, false);
  window.scrollTo(0, 0);
}

let salue = false;
function nouveau() {
  editing = false;
  remplir(brouillon.read());
  montrer("form");
  aller(0);
  if (!salue) {
    // l'arrivée ne se joue qu'une fois : la classe part quand l'affiche est posée
    salue = true;
    document.body.classList.add("arrive");
    setTimeout(() => document.body.classList.remove("arrive"), 1800);
    salve();
  }
}

function probleme(err) {
  $("problem-text").textContent = err && err.server ? err.message : "Vérifie ta connexion et réessaie.";
  montrer("problem");
}

async function charger() {
  montrer("loading");
  try {
    if (jeton.get()) {
      try {
        const { moi } = await db.post({ action: "moi" });
        return montrerStatut(moi, false);
      } catch (err) {
        if (err.code !== "jeton") throw err; // une panne ou un refus passager ne doit pas faire perdre sa fiche
        jeton.clear(); // le script ne connaît pas ce jeton : on repart sur une nouvelle inscription
      }
    }
    const { ouvert } = await db.ouvert();
    if (ouvert === false) return montrer("closed");
    nouveau();
  } catch (err) {
    probleme(err);
  }
}

function start() {
  if (API && !KEY) {
    $("lock").hidden = false;
    $("app").hidden = true;
    return;
  }
  $("essai").hidden = !!API;
  typo(document.body);
  const cd = rebours();
  $("countdown").hidden = !cd;
  $("countdown").textContent = cd;
  $("ticket-cd").textContent = cd;
  $("prix").textContent = euros(PRIX);
  $("dedans").append(...DEDANS.map(m => h("li", null, m)));
  frise($("frise-cover"), FRISE_COVER);
  frise($("frise-suite"), FRISE_SUITE);
  form.addEventListener("change", e => {
    // dès qu'on corrige ce qui était signalé, le message s'en va
    if (e.target.closest(".bad")) { marquer(null); $("msg").textContent = ""; }
    garder();
  });
  form.addEventListener("input", garder);
  form.addEventListener("submit", suite);
  $("back").addEventListener("click", retour);
  $("retry").addEventListener("click", charger);
  // sur la couverture, le ciel au-dessus du titre ; ailleurs, les gerbes restent à droite du titre, au-dessus du sous-titre
  sky($("sky"), () => {
    const c = $("sky").getBoundingClientRect(), t = document.querySelector(".top h1").getBoundingClientRect();
    if (document.body.classList.contains("cover")) return { x0: 14, x1: c.width - 14, y0: 6, y1: t.top - c.top - 4, max: 70, rate: .45 };
    const s = document.querySelector(".subtitle").getBoundingClientRect();
    return { x0: t.right - c.left + 10, x1: c.width - 16, y0: 4, y1: s.top - c.top - 2 };
  });
  fx = sky($("fx"), null);
  charger();
}
start();
