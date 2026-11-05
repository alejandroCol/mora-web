"use client";

import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { BRAND } from "@/brand";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  CREATOR_COPY,
  MAX_FOLLOWERS,
  NETWORKS,
  cleanEmail,
  cleanHandle,
  cleanName,
  cleanNetworkName,
  cleanPhone,
  formatFollowers,
  isNetworkId,
  parseFollowers,
  type NetworkId,
} from "@/lib/creatorApplication";
import { track } from "@/growth/track";
import { CreadoresTitleHero } from "./CreadoresTitleHero";
import "./creadores.css";

type Phase = "intro" | "form" | "done";
type Issue = { field: string; text: string } | null;

const STEPS = ["contacto", "redes"] as const;

const HINTS = ["Así te contactamos.", "La red donde más te siguen."];

const COUNTRIES = [
  { code: "CO", dial: "57", name: "Colombia", placeholder: "300 000 0000" },
  { code: "MX", dial: "52", name: "México", placeholder: "55 0000 0000" },
  { code: "AR", dial: "54", name: "Argentina", placeholder: "11 0000 0000" },
  { code: "CL", dial: "56", name: "Chile", placeholder: "9 0000 0000" },
  { code: "PE", dial: "51", name: "Perú", placeholder: "900 000 000" },
  { code: "EC", dial: "593", name: "Ecuador", placeholder: "99 000 0000" },
  { code: "ES", dial: "34", name: "España", placeholder: "600 000 000" },
  { code: "US", dial: "1", name: "Estados Unidos", placeholder: "201 000 0000" },
] as const;

export function Creadores() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"next" | "back">("next");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState<(typeof COUNTRIES)[number]["code"]>("CO");
  const [localPhone, setLocalPhone] = useState("");
  const [codesOpen, setCodesOpen] = useState(false);
  const [network, setNetwork] = useState<NetworkId | "">("");
  const [networkName, setNetworkName] = useState("");
  const [handle, setHandle] = useState("");
  const [followers, setFollowers] = useState("");
  const [extraOpen, setExtraOpen] = useState(false);
  const [secondaryNetwork, setSecondaryNetwork] = useState<NetworkId | "">("");
  const [secondaryName, setSecondaryName] = useState("");
  const [secondaryHandle, setSecondaryHandle] = useState("");
  const [trap, setTrap] = useState("");
  const [issue, setIssue] = useState<Issue>(null);
  const [pending, setPending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [already, setAlready] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const baseId = useId();

  useEffect(() => {
    if (phase !== "form") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "form") return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--cr-kb", `${Math.round(inset)}px`);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      root.style.removeProperty("--cr-kb");
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "form") return;
    sheetRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase !== "form") return;
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase, step]);

  function openForm() {
    setIssue(null);
    setPhase("form");
  }

  function closeForm() {
    setPhase("intro");
    window.setTimeout(() => openRef.current?.focus(), 30);
  }

  function clearIssue(field: string) {
    setIssue((current) => (current?.field === field ? null : current));
  }

  function focusField(event: FocusEvent<HTMLElement>) {
    const node = event.currentTarget;
    window.setTimeout(() => {
      node.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 280);
  }

  function composedPhone() {
    const country = COUNTRIES.find((item) => item.code === countryCode) ?? COUNTRIES[0];
    const digits = localPhone.replace(/\D/g, "");
    return { country, digits, value: `+${country.dial}${digits}` };
  }

  function validateStep(index: number): Issue {
    if (index === 0) {
      if (!cleanName(name)) return { field: "name", text: CREATOR_COPY.name };
      if (!cleanEmail(email)) return { field: "email", text: CREATOR_COPY.email };
      const composed = composedPhone();
      if (!composed.digits) return { field: "phone", text: CREATOR_COPY.phone };
      if (composed.country.code === "CO" && composed.digits.length !== 10) {
        return { field: "phone", text: "En Colombia el celular tiene 10 dígitos." };
      }
      if (!cleanPhone(composed.value)) return { field: "phone", text: CREATOR_COPY.phone };
      return null;
    }
    if (index === 1) {
      if (!isNetworkId(network)) return { field: "network", text: CREATOR_COPY.network };
      if (network === "otra" && !cleanNetworkName(networkName)) {
        return { field: "networkName", text: CREATOR_COPY.networkName };
      }
      if (!cleanHandle(handle)) return { field: "handle", text: CREATOR_COPY.handle };
      const count = parseFollowers(followers);
      if (count == null) return { field: "followers", text: CREATOR_COPY.followersMissing };
      if (count > MAX_FOLLOWERS) return { field: "followers", text: CREATOR_COPY.followersHigh };
      const extra = extraOpen && (secondaryNetwork !== "" || secondaryHandle.trim() !== "");
      if (extra) {
        if (!isNetworkId(secondaryNetwork)) {
          return { field: "secondaryNetwork", text: CREATOR_COPY.network };
        }
        if (secondaryNetwork === network) {
          return { field: "secondaryNetwork", text: "Elige una red distinta." };
        }
        if (secondaryNetwork === "otra" && !cleanNetworkName(secondaryName)) {
          return { field: "secondaryName", text: CREATOR_COPY.networkName };
        }
        if (!cleanHandle(secondaryHandle)) {
          return { field: "secondaryHandle", text: CREATOR_COPY.handle };
        }
      }
      return null;
    }
    return null;
  }

  async function submit() {
    if (sendingRef.current) return;
    const blocker = validateStep(STEPS.length - 1);
    if (blocker) {
      setIssue(blocker);
      return;
    }
    sendingRef.current = true;
    setPending(true);
    setIssue(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const body = new FormData();
      body.set("name", name);
      body.set("email", email);
      body.set("phone", composedPhone().value);
      body.set("network", network);
      body.set("networkName", networkName);
      body.set("handle", handle);
      body.set("followers", followers);
      body.set("secondaryNetwork", extraOpen ? secondaryNetwork : "");
      body.set("secondaryName", extraOpen ? secondaryName : "");
      body.set("secondaryHandle", extraOpen ? secondaryHandle : "");
      body.set("mora_hp", trap);

      const res = await fetch("/api/creadores", { method: "POST", body, signal: controller.signal });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        field?: string;
        emailSent?: boolean;
        already?: boolean;
      } | null;
      if (!res.ok || !data?.ok) {
        setIssue({
          field: data?.field || "form",
          text: data?.error || "No se pudo enviar. Intenta de nuevo.",
        });
        return;
      }
      setEmailSent(Boolean(data.emailSent));
      setAlready(Boolean(data.already));
      if (!data.already) {
        track(
          "CompleteRegistration",
          {
            content_name: "Registro creadores UGC",
            content_category: "ugc",
            content_ids: ["creadores"],
          },
          {
            email,
            phone: composedPhone().value,
            firstName: name.trim().split(/\s+/)[0],
          },
        );
      }
      setPhase("done");
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      setIssue({
        field: "form",
        text: aborted
          ? "Tardó demasiado. Intenta de nuevo."
          : error instanceof Error
            ? error.message
            : "No se pudo enviar. Intenta de nuevo.",
      });
    } finally {
      window.clearTimeout(timer);
      sendingRef.current = false;
      setPending(false);
    }
  }

  function goNext() {
    if (pending) return;
    const blocker = validateStep(step);
    if (blocker) {
      setIssue(blocker);
      return;
    }
    setIssue(null);
    if (step < STEPS.length - 1) {
      setDir("next");
      setStep(step + 1);
      return;
    }
    void submit();
  }

  function goBack() {
    if (pending) return;
    setIssue(null);
    if (step === 0) {
      closeForm();
      return;
    }
    setDir("back");
    setStep(step - 1);
  }

  function blurFollowers() {
    const count = parseFollowers(followers);
    if (count == null) return;
    setFollowers(formatFollowers(count));
    if (count > MAX_FOLLOWERS) setIssue({ field: "followers", text: CREATOR_COPY.followersHigh });
    else clearIssue("followers");
  }

  const invalid = issue?.field;
  const note = issue?.text ?? "";

  return (
    <main className="creadores">
      <section className="cr-hero" inert={phase === "form" ? true : undefined}>
        <div className="cr-banner-wrap">
          <img
            src="/creadores/fondo.jpg"
            alt=""
            width={1024}
            height={409}
            className="cr-banner"
            draggable={false}
            fetchPriority="high"
          />
          <a href="/" className="cr-logo" aria-label={BRAND.name}>
            <BrandLogo variant="wordmark" priority className="w-auto max-w-[8.5rem] object-contain" />
          </a>
        </div>
        <div className="cr-stage">
          {phase === "done" ? (
            <div className="cr-done">
              <span className="cr-check" aria-hidden="true">
                <svg viewBox="0 0 52 52">
                  <circle cx="26" cy="26" r="22" />
                  <path d="M16 27.5 23 34.5 37 19" />
                </svg>
              </span>
              <p className="cr-kicker">Creadores</p>
              <h1>{already ? "Ya te teníamos." : "Estamos emocionados."}</h1>
              <p>
                {already
                  ? "Tu registro sigue en revisión. Vamos a mirar tus redes y te contactaremos."
                  : "Recibimos tu interés. Revisaremos tus redes y nos comunicaremos pronto."}
              </p>
              <p className="cr-mail">
                {emailSent && !already
                  ? `Te escribimos a ${cleanEmail(email) ?? email.trim()}.`
                  : `Te contactaremos en ${cleanEmail(email) ?? email.trim()}.`}
              </p>
            </div>
          ) : (
            <div className="cr-copy">
              <CreadoresTitleHero>
                <h1>
                  Usa tu mora
                  <br />
                  antes que nadie
                </h1>
              </CreadoresTitleHero>
              <p className="cr-lead">Sé de los primeros.</p>
              <button ref={openRef} type="button" className="cr-cta" onClick={openForm}>
                Registrarme
              </button>
            </div>
          )}
        </div>
      </section>

      {phase === "form" ? (
        <>
          <button type="button" className="cr-dim" aria-label="Cerrar" onClick={closeForm} />
          <form
            ref={sheetRef}
            className="cr-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${baseId}-title`}
            tabIndex={-1}
            onSubmit={(event) => {
              event.preventDefault();
              goNext();
            }}
          >
            <div className="cr-sheet-art" aria-hidden="true" />
            <div className="cr-sheet-head">
              <button type="button" className="cr-x" aria-label="Cerrar" onClick={closeForm}>
                <svg viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    d="M4 4l10 10M14 4 4 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <div className="cr-dots" aria-hidden="true">
                {STEPS.map((item, index) => (
                  <i key={item} data-on={index <= step ? "true" : "false"} />
                ))}
              </div>
              <span />
            </div>
            <div className="cr-sheet-scroll" ref={scrollRef}>
              <p className="sr-only">Paso {step + 1} de {STEPS.length}</p>
              <div className="cr-trap" aria-hidden="true">
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={trap}
                  onChange={(event) => setTrap(event.target.value)}
                />
              </div>
              <div key={step} className="cr-step" data-dir={dir}>
                {step === 0 ? (
                  <>
                    <h2 id={`${baseId}-title`}>Cómo te escribimos</h2>
                    <div className="cr-fields">
                      <label className="cr-field">
                        <span>Nombre</span>
                        <input
                          id={`${baseId}-name`}
                          value={name}
                          autoComplete="name"
                          autoCapitalize="words"
                          enterKeyHint="next"
                          aria-invalid={invalid === "name"}
                          onFocus={focusField}
                          onChange={(event) => {
                            setName(event.target.value);
                            clearIssue("name");
                          }}
                        />
                      </label>
                      <label className="cr-field">
                        <span>Correo</span>
                        <input
                          value={email}
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          enterKeyHint="next"
                          aria-invalid={invalid === "email"}
                          onFocus={focusField}
                          onChange={(event) => {
                            setEmail(event.target.value);
                            clearIssue("email");
                          }}
                        />
                      </label>
                      <div className="cr-field">
                        <span>WhatsApp</span>
                        <div className="cr-phone">
                          <div className="cr-dial">
                            <button
                              type="button"
                              className="cr-dial-btn"
                              aria-expanded={codesOpen}
                              aria-haspopup="listbox"
                              onClick={() => setCodesOpen((open) => !open)}
                            >
                              <small>{countryCode}</small>
                              +{COUNTRIES.find((item) => item.code === countryCode)?.dial}
                            </button>
                            {codesOpen ? (
                              <div className="cr-codes" role="listbox" aria-label="Código de área">
                                {COUNTRIES.map((item) => (
                                  <button
                                    key={item.code}
                                    type="button"
                                    role="option"
                                    aria-selected={item.code === countryCode}
                                    onClick={() => {
                                      setCountryCode(item.code);
                                      setCodesOpen(false);
                                      clearIssue("phone");
                                    }}
                                  >
                                    {item.name}
                                    <span>
                                      +{item.dial}
                                      {item.code === "CO" ? <em> Sugerido</em> : null}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <input
                            value={localPhone}
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            placeholder={COUNTRIES.find((item) => item.code === countryCode)?.placeholder}
                            enterKeyHint="next"
                            aria-invalid={invalid === "phone"}
                            aria-label="Número de WhatsApp"
                            onFocus={focusField}
                            onChange={(event) => {
                              setLocalPhone(event.target.value);
                              clearIssue("phone");
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {step === 1 ? (
                  <>
                    <h2 id={`${baseId}-title`}>Tus redes</h2>
                    <div className="cr-fields">
                      <div className="cr-field">
                        <span id={`${baseId}-net`}>Red principal</span>
                        <div className="cr-chips" role="group" aria-labelledby={`${baseId}-net`}>
                          {NETWORKS.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="cr-chip"
                              aria-pressed={network === item.id}
                              onClick={() => {
                                setNetwork(item.id);
                                clearIssue("network");
                              }}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {network === "otra" ? (
                        <label className="cr-field">
                          <span>Cuál</span>
                          <input
                            value={networkName}
                            placeholder="Twitch, podcast…"
                            aria-invalid={invalid === "networkName"}
                            onFocus={focusField}
                            onChange={(event) => {
                              setNetworkName(event.target.value);
                              clearIssue("networkName");
                            }}
                          />
                        </label>
                      ) : null}
                      <label className="cr-field">
                        <span>Usuario</span>
                        <input
                          value={handle}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="tuusuario"
                          enterKeyHint="next"
                          aria-invalid={invalid === "handle"}
                          onFocus={focusField}
                          onChange={(event) => {
                            setHandle(event.target.value);
                            clearIssue("handle");
                          }}
                        />
                      </label>
                      <label className="cr-field">
                        <span>Seguidores</span>
                        <input
                          value={followers}
                          inputMode="decimal"
                          placeholder="1.200"
                          enterKeyHint="done"
                          aria-invalid={invalid === "followers"}
                          onFocus={focusField}
                          onBlur={blurFollowers}
                          onChange={(event) => {
                            setFollowers(event.target.value);
                            clearIssue("followers");
                          }}
                        />
                      </label>
                      {extraOpen ? (
                        <>
                          <div className="cr-field">
                            <span id={`${baseId}-net2`}>Otra red</span>
                            <div className="cr-chips" role="group" aria-labelledby={`${baseId}-net2`}>
                              {NETWORKS.filter((item) => item.id !== network).map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className="cr-chip"
                                  aria-pressed={secondaryNetwork === item.id}
                                  onClick={() => {
                                    setSecondaryNetwork(item.id);
                                    clearIssue("secondaryNetwork");
                                  }}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {secondaryNetwork === "otra" ? (
                            <label className="cr-field">
                              <span>Cuál</span>
                              <input
                                value={secondaryName}
                                aria-invalid={invalid === "secondaryName"}
                                onFocus={focusField}
                                onChange={(event) => {
                                  setSecondaryName(event.target.value);
                                  clearIssue("secondaryName");
                                }}
                              />
                            </label>
                          ) : null}
                          <label className="cr-field">
                            <span>Usuario</span>
                            <input
                              value={secondaryHandle}
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              placeholder="tuusuario"
                              aria-invalid={invalid === "secondaryHandle"}
                              onFocus={focusField}
                              onChange={(event) => {
                                setSecondaryHandle(event.target.value);
                                clearIssue("secondaryHandle");
                              }}
                            />
                          </label>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="cr-linkish"
                          onClick={() => setExtraOpen(true)}
                        >
                          Añadir otra red
                        </button>
                      )}
                    </div>
                  </>
                ) : null}
                {note ? (
                  <p className="cr-note cr-note--alert" role="alert">
                    {note}
                  </p>
                ) : (
                  <p className="cr-hint">{HINTS[step]}</p>
                )}
              </div>
            </div>
            {pending ? (
              <div className="cr-sending" role="status" aria-live="polite">
                <BrandLoader label="Enviando" />
                <p className="cr-sending-label">Enviando</p>
              </div>
            ) : null}
            <div className="cr-bar">
              {step > 0 ? (
                <button type="button" className="cr-back" onClick={goBack}>
                  Atrás
                </button>
              ) : null}
              <button type="submit" className="cr-next" disabled={pending} aria-busy={pending}>
                {pending ? "Enviando" : step < STEPS.length - 1 ? "Seguir" : "Enviar"}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </main>
  );
}
