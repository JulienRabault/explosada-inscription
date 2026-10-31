"use strict";

const $ = id => document.getElementById(id);
const REGLES = [
  "Je fais ma part quand c'est le tour de mon équipe, pas que les autres",
  "Le ménage de fin de séjour, on le fait tous, personne part en laissant tout",
  "La musique, je coupe à l'heure que dit la maison. Le voisin, c'est pas notre ami",
  "Si je casse un truc, je le dis tout de suite. La caution, c'est pour tout le monde",
  "Je ramène personne sans prévenir avant",
  "Je paye dans les temps quand le montant tombe, sinon ma place peut partir",
];
const TEL = /^[+\d][\d .()-]{5,24}$/;
const NOM = /^\p{L}[\p{L}'’ .-]*$/u;
const CHECK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
const DERNIERE = 5;

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false && k !== "") e.append(k);
  return e;
}
function tick() {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.6", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: "tick" })) s.setAttribute(k, v);
  s.innerHTML = CHECK;
  return s;
}

let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- le formulaire, en étapes courtes ---------- */

const form = $("form");
let editing = false;
let etape = 0;

// une ligne par option : cases pour plusieurs choix, ronds pour un seul
function options(id, liste, type) {
  const box = $(id);
  const name = box.dataset.name;
  liste.forEach(v => box.append(h("label", { class: "opt" },
    h("input", { type, name, value: v }), h("span", { class: "txt" }, v), tick())));
}

// un choix court sur une ligne, en contrôle segmenté iOS
function segments(id, liste) {
  const box = $(id);
  const name = box.dataset.name;
  liste.forEach(v => box.append(h("label", null, h("input", { type: "radio", name, value: v }), h("span", null, v))));
}

const coches = name => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
const val = name => (form.elements[name] ? form.elements[name].value : "");

function lire() {
  const ok = form.elements["regles-ok"].checked;
  const mixe = form.elements.mixer.checked;
  const alcool = coches("alcool")[0] || "";
  return {
    prenom: val("prenom").trim().replace(/\s+/g, " "), nom: val("nom").trim().replace(/\s+/g, " "), tel: val("tel").trim(),
    nuits: coches("nuits"), arrivee: coches("arrivee")[0] || "", transport: coches("transport")[0] || "",
    places: val("places").trim(), depart: val("depart").trim(),
    allergies: val("allergies").trim(), pasManger: val("pasManger").trim(), regime: coches("regime"),
    appetit: coches("appetit")[0] || "", alcool,
    boissons: alcool && alcool !== ALCOOLS[0] ? coches("boissons") : [],
    regles: REGLES.map(() => ok),
    atouts: val("atouts").trim(), pasFaire: val("pasFaire").trim(),
    activite: form.elements["activite-on"].checked ? val("activite").trim() : "",
    mixer: mixe ? "Oui" : "Non",
    son: mixe ? val("son").trim() : "", creneau: mixe ? val("creneau").trim() : "",
    mot: val("mot").trim(),
  };
}

function remplir(d) {
  const set = (name, v) => { if (form.elements[name] && v != null) form.elements[name].value = v; };
  ["prenom", "nom", "tel", "places", "depart", "allergies", "pasManger", "atouts", "pasFaire", "activite", "son", "creneau", "mot"].forEach(k => set(k, d[k]));
  const cocher = (name, valeurs) => form.querySelectorAll(`input[name="${name}"]`).forEach(i => { i.checked = valeurs.includes(i.value); });
  cocher("nuits", d.nuits || []);
  cocher("arrivee", d.arrivee ? [d.arrivee] : []);
  cocher("transport", d.transport ? [d.transport] : []);
  cocher("regime", d.regime || []);
  cocher("appetit", d.appetit ? [d.appetit] : []);
  cocher("alcool", d.alcool ? [d.alcool] : []);
  cocher("boissons", d.boissons || []);
  form.elements.mixer.checked = d.mixer === "Oui";
  form.elements["activite-on"].checked = !!d.activite;
  form.elements["regles-ok"].checked = !!(d.regles && d.regles.length && d.regles.every(Boolean));
  suivre();
}

// ce qui dépend d'une réponse : les places (voiture), ce qu'il boit, le détail du mix et de l'activité
function suivre() {
  const alcool = coches("alcool")[0];
  $("boissons-box").hidden = !alcool || alcool === ALCOOLS[0];
  const voiture = coches("transport")[0] === TRANSPORTS[0];
  $("voiture-group").hidden = !voiture;
  $("voiture-foot").hidden = !voiture;
  $("mixer-plus").hidden = !form.elements.mixer.checked;
  $("activite-plus").hidden = !form.elements["activite-on"].checked;
}

// premier problème trouvé, avec l'étape où il se corrige
function verifier(d) {
  const bad = (msg, el, step) => ({ msg, el, step });
  const champ = n => form.elements[n].closest(".field");
  if (!d.prenom || d.prenom.length > 30 || !NOM.test(d.prenom)) return bad("Il faut ton prénom", champ("prenom"), 1);
  if (!d.nom || d.nom.length > 40 || !NOM.test(d.nom)) return bad("Il faut ton nom", champ("nom"), 1);
  if (!TEL.test(d.tel)) return bad("Ton numéro n'a pas l'air bon", champ("tel"), 1);
  if (!d.nuits.length) return bad("Choisis au moins une nuit", $("nuits"), 2);
  if (!d.arrivee) return bad("Dis quand tu arrives", $("arrivee"), 2);
  if (!d.transport) return bad("Dis comment tu viens", $("transport"), 2);
  if (d.transport === TRANSPORTS[0] && !(d.places !== "" && Number(d.places) >= 0 && Number(d.places) <= 8)) return bad("Entre 0 et 8 places libres", champ("places"), 2);
  if (!d.appetit) return bad("Dis-moi ton appétit, c'est pour les courses", $("appetit"), 3);
  if (!d.alcool) return bad("Dis-moi côté alcool, c'est pour les courses", $("alcool"), 3);
  if (d.regles.some(r => !r)) return bad("Il faut être ok avec les règles pour valider ta place", $("regles-ok-group"), 4);
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
  $("send").textContent = n === DERNIERE ? (editing ? "Enregistrer" : "Envoyer") : n === 0 ? "Commencer" : "Suivant";
  $("send-foot").hidden = n !== DERNIERE || editing;
  $("msg").textContent = "";
  marquer(null);
  if (defiler) window.scrollTo(0, 0);
}

/* ---------- les feux : le ciel du titre, et un calque pour les moments forts ---------- */

let fx = { fire() {} };

function petard() {
  if ($("stepbar").hidden) return;
  const s = document.querySelector(".fuse-spark").getBoundingClientRect();
  fx.fire(s.left + s.width / 2, s.top + s.height / 2, 26);
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
    const res = await db.post({ action: "inscrire", ...d, places: d.transport === TRANSPORTS[0] ? Number(d.places) : "" });
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
  reçue: { pill: "Reçue", couleur: "orange", titre: "C'est bon, c'est reçu", texte: "Ta place est validée quand je confirme. Le montant arrive dès qu'on a la maison, il comprend tout : la maison, la bouffe, l'alcool, le reste. Je te dis comment payer à ce moment là." },
  validée: { pill: "Validée", couleur: "green", titre: "Ta place est validée", texte: "Le montant arrive dès qu'on a la maison, il comprend tout. Je te dis comment payer à ce moment là." },
  payée: { pill: "Payée", couleur: "green", titre: "C'est payé, t'es bon", texte: "Y a plus rien à faire de ton côté." },
  annulée: { pill: "Annulée", couleur: "gray", titre: "Ton inscription est annulée", texte: "Si c'est pas normal, écris-moi." },
};

function ligne(nom, v) {
  return v ? h("div", { class: "recap-row" }, h("dt", null, nom), h("dd", null, v)) : null;
}

let fiche = null;
function montrerStatut(moi, envoyee) {
  fiche = moi;
  const t = STATUTS_TXT[moi.statut] || STATUTS_TXT["reçue"];
  const pill = $("status-pill");
  pill.textContent = t.pill;
  pill.className = "pill " + t.couleur;
  $("status-title").textContent = t.titre;
  $("status-text").textContent = moi.statut === "validée" && moi.montant && moi.payer ? "Il reste à payer ta part, c'est juste en dessous." : t.texte;

  const paye = moi.statut === "validée" && moi.montant && moi.payer;
  $("pay").hidden = !paye;
  if (paye) {
    $("pay-amount").textContent = String(moi.montant);
    $("pay-how").textContent = moi.payer;
  }

  // l'équipe est donnée par Julien : tant qu'il n'a rien mis, la page n'en parle pas
  const equipe = $("team");
  equipe.hidden = !moi.couleur;
  if (moi.couleur) {
    $("team-name").textContent = moi.couleur;
    equipe.dataset.couleur = moi.couleur;
    $("team-plan").textContent = moi.planning || "Le planning arrive.";
  }

  const voiture = moi.transport === TRANSPORTS[0];
  const recap = $("recap");
  recap.replaceChildren(h("h2", { class: "sec-h" }, "Ce que t'as répondu"), h("dl", { class: "group" },
    ligne("Nom", [moi.prenom, moi.nom].filter(Boolean).join(" ")),
    ligne("Nuits", (moi.nuits || []).join(", ")),
    ligne("Arrivée", moi.arrivee),
    ligne("Transport", voiture ? `${moi.transport}, ${moi.places} place${Number(moi.places) > 1 ? "s" : ""} libre${Number(moi.places) > 1 ? "s" : ""}` : moi.transport),
    ligne("Allergies", moi.allergies),
    ligne("Mange pas", [moi.pasManger, ...(moi.regime || [])].filter(Boolean).join(", ")),
    ligne("Appétit", moi.appetit),
    ligne("Alcool", [moi.alcool, ...(moi.boissons || [])].filter(Boolean).join(", ")),
    ligne("Sait faire", moi.atouts),
    ligne("Préfère pas", moi.pasFaire),
    ligne("Mix", moi.mixer === "Oui" ? [moi.son, moi.creneau].filter(Boolean).join(", ") || "Oui" : ""),
    ligne("Activité", moi.activite)));
  $("edit-group").hidden = moi.statut === "payée" || moi.statut === "annulée";
  $("edit").onclick = () => editer(moi);
  montrer("status");
  if (envoyee) toast("Envoyé");
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

function nouveau() {
  editing = false;
  remplir(brouillon.read());
  montrer("form");
  aller(0);
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
  options("nuits", NUITS, "checkbox");
  options("arrivee", ARRIVEES, "radio");
  options("transport", TRANSPORTS, "radio");
  options("regime", REGIMES, "checkbox");
  segments("appetit", APPETITS);
  segments("alcool", ALCOOLS);
  options("boissons", BOISSONS, "checkbox");
  $("regles-liste").append(...REGLES.map(r => h("li", null, r)));
  form.addEventListener("change", e => {
    // dès qu'on corrige ce qui était signalé, le message s'en va
    if (e.target.closest(".bad")) { marquer(null); $("msg").textContent = ""; }
    suivre();
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
