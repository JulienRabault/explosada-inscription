"use strict";

/* Accès aux données : la Google Sheet (via Apps Script), ou un essai local quand elle n'est pas branchée.
   Même principe que la page des lieux : une clé dans le lien, et un jeton perso gardé sur le téléphone. */

const API = (window.API_URL || "").trim();

// listes autorisées : les mêmes que dans apps-script/Code.gs, qui les revérifie de son côté
const NUITS = ["31 déc. → 1er janv.", "1er → 2 janv.", "2 → 3 janv."];
const ARRIVEES = ["Le 31 au matin", "Le 31 l'après-midi", "Le 31 en soirée", "Le 1er janvier", "Le 2 janvier"];
const TRANSPORTS = ["J'ai une voiture", "Je cherche une place en voiture", "Je me débrouille"];
const REGIMES = ["Végétarien", "Végan", "Sans porc", "Halal", "Sans gluten", "Sans lactose"];
const APPETITS = ["Petit", "Normal", "Gros"];
const ALCOOLS = ["Je bois pas", "Un peu", "Normal", "Pas mal"];
const BOISSONS = ["Bière", "Vin", "Alcool fort, cocktails", "Champagne"];
const MIXER = ["Oui", "Non"];

// préfixe : toutes les pages julienrabault.github.io partagent le même stockage
const store = {
  get(k) { try { return localStorage.getItem("explosada-inscription-" + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("explosada-inscription-" + k, v); } catch (e) { /* stockage indisponible : on continue sans */ } },
  del(k) { try { localStorage.removeItem("explosada-inscription-" + k); } catch (e) { /* idem */ } },
};

// La clé arrive dans le lien (#k=… ou ?k=…) et reste dans l'adresse en ?k=… : certains navigateurs
// intégrés (Instagram, WhatsApp) perdent la partie après #. On la garde aussi sur le téléphone.
const KEY = (() => {
  const valid = k => (/^[\w-]{8,64}$/.test(k || "") ? k : "");
  const fromHash = (location.hash.match(/k=([\w-]{8,64})/) || [])[1];
  const fromQuery = valid(new URLSearchParams(location.search).get("k"));
  const key = fromHash || fromQuery || store.get("cle") || "";
  if (!key) return "";
  store.set("cle", key);
  const url = location.pathname + "?k=" + key;
  if (location.pathname + location.search + location.hash !== url) history.replaceState(null, "", url);
  return key;
})();

// Le jeton donne accès à SA fiche et à elle seule : il est créé par le script à la première inscription.
const jeton = {
  get() { const t = store.get("jeton") || ""; return /^[\w-]{8,64}$/.test(t) ? t : ""; },
  set(t) { if (/^[\w-]{8,64}$/.test(t || "")) store.set("jeton", t); },
  clear() { store.del("jeton"); },
  // fabriqué sur le téléphone avant le premier envoi : si la réponse se perd, le renvoi retrouve la même fiche
  ensure() {
    if (this.get()) return this.get();
    const t = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
    this.set(t);
    return t;
  },
};

// Brouillon : ce qui est rempli reste sur le téléphone, pour qu'un appel ou un onglet fermé ne fasse rien perdre.
const brouillon = {
  read() { try { return JSON.parse(store.get("brouillon")) || {}; } catch (e) { return {}; } },
  save(d) { store.set("brouillon", JSON.stringify(d)); },
  clear() { store.del("brouillon"); },
};

// un réseau qui ne répond pas ne doit pas laisser le bouton bloqué
async function fetch20(url, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); } finally { clearTimeout(timer); }
}
// refus du script : message fait pour la page (à l'inverse d'une panne de réseau)
function refus(msg, code) {
  const e = new Error(msg);
  e.server = true;
  if (code) e.code = code;
  return e;
}
function check(res) {
  if (!res) throw new Error("Réponse vide");
  if (res.error) throw refus(res.error, res.code);
  return res;
}

const remote = {
  async ouvert() {
    const r = await fetch20(API + (API.includes("?") ? "&" : "?") + "k=" + encodeURIComponent(KEY) + "&t=" + Date.now(), { cache: "no-store" });
    return check(await r.json());
  },
  async post(req) {
    // text/plain : pas de requête préalable CORS, Apps Script lit le corps tel quel
    const r = await fetch20(API, { method: "POST", body: JSON.stringify({ ...req, k: KEY, jeton: jeton.get() }) });
    return check(await r.json());
  },
};

/* Essai local : rejoue la forme des réponses du script, enregistré sur ce téléphone seulement. */
const local = {
  async ouvert() { return { ouvert: true, inscrits: 0 }; },
  async post(req) {
    if (req.action === "moi") {
      const moi = JSON.parse(store.get("essai") || "null");
      if (!moi) throw refus("Fiche introuvable");
      return { moi };
    }
    const { action, k, jeton: _j, ...fiche } = req;
    const moi = { ...fiche, statut: "reçue", montant: null, payer: "" };
    store.set("essai", JSON.stringify(moi));
    return { moi, jeton: "essai-" + Date.now().toString(36) };
  },
};
const db = API ? remote : local;
