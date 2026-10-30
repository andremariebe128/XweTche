import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CONTACT } from "../data/contact";
import { useTitre } from "../lib/titre";

const SUJETS = ["Une question sur une annonce", "Une visite", "Un paiement ou un reçu", "Je suis propriétaire", "Un problème avec mon compte", "Autre"];

export default function Contact() {
  useTitre("Contact");
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [sujet, setSujet] = useState("");
  const [message, setMessage] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [essai, setEssai] = useState(false);

  const erreurs = {
    nom: !nom.trim() ? "Indiquez votre nom." : "",
    tel: tel.replace(/\D/g, "").length < 8 ? "Indiquez un numéro d'au moins 8 chiffres." : "",
    sujet: !sujet ? "Choisissez un sujet." : "",
    message: message.trim().length < 10 ? "Écrivez au moins 10 caractères." : "",
  };
  const valide = !Object.values(erreurs).some(Boolean);
  const err = (k: keyof typeof erreurs) => (essai ? erreurs[k] : "");

  return (
    <div className="wrap edito">
      <p className="eyebrow">Contact</p>
      <h1 className="h1">Parlons-en</h1>
      <p className="lede">
        Une question sur une annonce, une visite ou un paiement ? Le plus rapide est WhatsApp. Vous pouvez aussi consulter{" "}
        <Link to="/aide">l'aide</Link>.
      </p>

      <div className="contact">
        <div className="contact__canaux">
          <a
            className="carte contact__canal contact__canal--principal"
            href={CONTACT.whatsapp ? `https://wa.me/${CONTACT.whatsapp}` : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!CONTACT.whatsapp}
          >
            <MessageCircle aria-hidden="true" />
            <span>
              <strong>WhatsApp</strong>
              <span className="gris">{CONTACT.whatsapp ? `+${CONTACT.whatsapp}` : "+229 [numéro à compléter]"} · compte vérifié</span>
            </span>
          </a>
          <a className="carte contact__canal" href={CONTACT.telephone ? `tel:${CONTACT.telephone}` : undefined} aria-disabled={!CONTACT.telephone}>
            <Phone aria-hidden="true" />
            <span>
              <strong>Téléphone</strong>
              <span className="gris">{CONTACT.telephone || "+229 [numéro à compléter]"}</span>
            </span>
          </a>
          <a className="carte contact__canal" href={CONTACT.email ? `mailto:${CONTACT.email}` : undefined} aria-disabled={!CONTACT.email}>
            <Mail aria-hidden="true" />
            <span>
              <strong>E-mail</strong>
              <span className="gris">{CONTACT.email || "[adresse à compléter]"}</span>
            </span>
          </a>
          <div className="carte contact__canal">
            <MapPin aria-hidden="true" />
            <span>
              <strong>Agence</strong>
              <span className="gris">{CONTACT.adresse}</span>
            </span>
          </div>
          <div className="carte contact__canal">
            <Clock aria-hidden="true" />
            <span>
              <strong>Horaires</strong>
              <span className="gris">{CONTACT.horaires}</span>
            </span>
          </div>
          <p className="petit gris">
            Nos SMS viennent uniquement de l'expéditeur « {CONTACT.expediteurSms} ». Nous ne demandons jamais de paiement avant une visite.
          </p>
        </div>

        <div className="carte contact__formulaire">
          {envoye ? (
            <div className="bandeau bandeau--succes" role="status">
              Message envoyé. Nous vous répondons par SMS ou WhatsApp au {tel}, en général dans la journée.
            </div>
          ) : (
            <form
              className="formulaire"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                setEssai(true);
                if (valide) setEnvoye(true);
              }}
            >
              <h2 className="h3">Écrivez-nous</h2>
              <Champ id="c-nom" label="Nom" erreur={err("nom")}>
                <input id="c-nom" autoComplete="name" value={nom} onChange={(e) => setNom(e.target.value)} aria-invalid={!!err("nom")} />
              </Champ>
              <Champ id="c-tel" label="Numéro de téléphone" erreur={err("tel")} aide="Nous vous répondons sur ce numéro.">
                <input id="c-tel" type="tel" inputMode="tel" autoComplete="tel" value={tel} onChange={(e) => setTel(e.target.value)} aria-invalid={!!err("tel")} />
              </Champ>
              <Champ id="c-sujet" label="Sujet" erreur={err("sujet")}>
                <select id="c-sujet" value={sujet} onChange={(e) => setSujet(e.target.value)} aria-invalid={!!err("sujet")}>
                  <option value="">Choisir…</option>
                  {SUJETS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Champ>
              <Champ id="c-message" label="Message" erreur={err("message")} aide="Si c'est à propos d'une annonce, indiquez sa référence (ex. XT-0412).">
                <textarea id="c-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} aria-invalid={!!err("message")} />
              </Champ>
              <button type="submit" className="btn btn--principal btn--bloc">
                Envoyer le message
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Champ({ id, label, erreur, aide, children }: { id: string; label: string; erreur?: string; aide?: string; children: React.ReactNode }) {
  return (
    <div className={`champ${erreur ? " champ--erreur" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {erreur ? <span className="champ__erreur">{erreur}</span> : aide ? <span className="aide">{aide}</span> : null}
    </div>
  );
}
