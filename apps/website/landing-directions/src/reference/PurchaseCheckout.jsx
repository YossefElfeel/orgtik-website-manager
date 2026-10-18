import React, {
  useState,
  useRef,
  useEffect,
  useSyncExternalStore,
} from "react";
import { CommerceLayout } from "./CommerceLayout";
import {
  useCart,
  completeCartPurchase,
  dismissCartNotice,
  getCartSnapshot,
} from "./purchase-store.js";
import {
  quoteCart,
  money,
  termLabel,
  groupFingerprint,
  getPricingSnapshot,
  subscribePricing,
} from "./purchase-catalog.js";
import { PurchasePriceStatus, taxCaption } from "./PurchasePricing";
import { QuoteSummary, PreviewNote, OrderContents } from "./PurchaseUI";
import { EmptyPurchaseCart } from "./PurchaseCart";
import { PurchaseAction, PurchaseDialog } from "./PurchaseControls";
import {
  simulatePayment,
  validateCustomer,
  savePurchaseSession,
  loadPurchaseSession,
  clearPurchaseSession,
  quoteWebsite,
  getPendingPayment,
  purchaseFingerprint,
  purchaseErrorText,
} from "./purchase-adapter.js";
import {
  getPreviewCustomer,
  subscribePreviewCustomer,
  signOutPreviewCustomer,
} from "./purchase-identity.js";
import {
  setupInSuite,
  hasSuiteSession,
  setupPurchaseAccount,
  validatePurchasePassword,
} from "./suite-session.js";
import {
  PAYMENT_METHODS,
  getPaymentMethod,
  validateTestPaymentDetails,
  createTestPaymentAuthorization,
} from "./purchase-payment.js";
import { PaymentDetails } from "./PaymentDetails";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";

function Confirmation({ order, crm, onCRM, customer, onRestart }) {
  const receiptMoney = (amount) => money(amount, order);
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [existingAccount, setExistingAccount] = useState(false);
  const passwordField = useRef(null);
  const confirmationField = useRef(null);
  const working = useRef(false);
  const activationChecked = useRef(false);
  const signedIn =
    hasSuiteSession() &&
    getPreviewCustomer()?.email?.toLowerCase() ===
      customer?.email?.toLowerCase();
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (handoff) passwordField.current?.focus();
  }, [handoff]);
  useEffect(() => {
    if (
      !signedIn ||
      handoff ||
      crm.status !== "ready" ||
      crm.tools ||
      activationChecked.current
    )
      return;
    activationChecked.current = true;
    setupInSuite(order, { verified: true }).then(onCRM);
  }, [signedIn, handoff, crm.status, crm.tools, order, onCRM]);
  const retry = async () => {
    if (busy) return;
    setBusy(true);
    try {
      onCRM(
        await setupInSuite(order, { scenario: "ready", verified: signedIn }),
      );
    } finally {
      setBusy(false);
    }
  };
  const openAccount = async () => {
    if (!signedIn) {
      setAccountError("");
      setExistingAccount(false);
      setHandoff(true);
      return;
    }
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setAccountError("");
    try {
      const { href } = await setupPurchaseAccount(order, customer);
      window.location.assign(href);
    } catch (error) {
      setAccountError(
        msg(error.message === "order" ? "PurchaseSetup:6" : "SuiteSignIn:2"),
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const setupAccount = async (event) => {
    event.preventDefault();
    if (working.current) return;
    const fields = new FormData(event.currentTarget);
    const password = fields.get("password");
    const problem = validatePurchasePassword(
      password,
      fields.get("confirmPassword"),
    );
    setAccountError("");
    if (problem) {
      setAccountError(msg(problem === "password" ? "SignIn:37" : "SignIn:38"));
      (problem === "password"
        ? passwordField
        : confirmationField
      ).current?.focus();
      return;
    }
    working.current = true;
    setBusy(true);
    event.currentTarget.reset();
    try {
      const { href } = await setupPurchaseAccount(order, customer, password);
      window.location.assign(href);
    } catch (error) {
      setExistingAccount(error.message === "exists");
      setAccountError(
        msg(
          error.message === "exists"
            ? "SuiteSignIn:3"
            : error.message === "billing"
              ? "PurchaseSetup:7"
              : error.message === "order"
                ? "PurchaseSetup:6"
                : "SuiteSignIn:2",
        ),
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="purchase-confirmation">
      <section className="purchase-checkout-panel">
        <span className="purchase-confirmed">
          <i className="ph ph-check-circle" aria-hidden="true" />
          {run("gl_commerce|purchaseCheckout-hero|section", 0)}
        </span>
        <p className="purchase-caption">
          {run("gl_commerce|purchaseCheckout-hero|p", 0)}
        </p>
        <h2 ref={heading} tabIndex={-1}>
          {run("gl_commerce|purchaseCheckout-hero|h2", 0)}
        </h2>
        <p>
          {run("gl_commerce|purchaseCheckout-hero|p-2", 0)}
          <strong>{order.reference}</strong> · {receiptMoney(order.quote.total)}{" "}
          {run("gl_commerce|purchaseCheckout-hero|p-3", 0)}
        </p>
        <p className="purchase-receipt-method">
          <i
            className={`ph ph-${getPaymentMethod(order.paymentMethod).icon}`}
            aria-hidden="true"
          />
          {run("gl_commerce|purchaseCheckout-hero|p-4", 0)}
          {getPaymentMethod(order.paymentMethod).name}
        </p>
        <div className="purchase-alert" role="status">
          <strong>
            {crm.status === "ready" && !signedIn
              ? msg("PurchaseSetup:8")
              : crm.status === "ready"
                ? msg("PurchaseCheckout:1")
                : crm.status === "failed"
                  ? msg("PurchaseCheckout:2")
                  : msg("PurchaseCheckout:3")}
          </strong>
          <p>
            {crm.status === "ready" && !signedIn
              ? msg("PurchaseSetup:2", [customer?.email || ""])
              : crm.status === "ready"
                ? msg("PurchaseCheckout:4")
                : msg("PurchaseCheckout:5")}
          </p>
        </div>
        <div className="purchase-confirmation-actions">
          {crm.status === "ready" ? (
            <PurchaseAction onClick={openAccount} disabled={busy}>
              {busy
                ? msg("PurchaseCheckout:8")
                : signedIn
                  ? msg("PurchaseCheckout:6")
                  : msg("PurchaseCheckout:7")}
            </PurchaseAction>
          ) : (
            <PurchaseAction onClick={retry} disabled={busy}>
              {busy
                ? msg("PurchaseCheckout:8")
                : crm.status === "failed"
                  ? msg("PurchaseCheckout:9")
                  : msg("PurchaseCheckout:10")}
            </PurchaseAction>
          )}
          <button
            type="button"
            className="purchase-text-button"
            onClick={onRestart}
          >
            {run("gl_commerce|purchaseCheckout-hero|button", 0)}
          </button>
        </div>
        {!handoff && accountError && (
          <p className="purchase-error" role="alert">
            {accountError}
          </p>
        )}
        <p className="purchase-caption">
          {run("gl_commerce|purchaseCheckout-hero|p-5", 0)}
        </p>
      </section>
      <section className="purchase-checkout-panel">
        <h2>{run("gl_commerce|purchaseCheckout-section-1|h2", 0)}</h2>
        <table className="purchase-receipt">
          <thead>
            <tr>
              <th>{run("gl_commerce|purchaseCheckout-section-1|th", 0)}</th>
              <th>{run("gl_commerce|purchaseCheckout-section-1|th-2", 0)}</th>
            </tr>
          </thead>
          <tbody>
            {order.groups.flatMap((g) =>
              g.lines.map((line) => (
                <tr key={`${g.id}:${line.catalogId}`}>
                  <td>
                    {line.name}
                    <small>
                      {termLabel(line.months)} ·{" "}
                      {line.autoRenew
                        ? msg("PurchaseCheckout:11")
                        : msg("PurchaseCheckout:12")}
                    </small>
                    {line.perUser && Number.isFinite(line.quantity) && (
                      <small>
                        {msg("PlatformPricing:18", [line.quantity])}
                      </small>
                    )}
                    <small>
                      {line.activation === "awaiting-link"
                        ? msg(
                            crm.tools?.some(
                              (tool) =>
                                tool.catalogId === line.catalogId &&
                                tool.state === "active",
                            )
                              ? "PlatformPricing:12"
                              : "PlatformPricing:11",
                          )
                        : line.activation === "active-preview"
                          ? msg("PurchaseCheckout:13")
                          : msg("PurchaseCheckout:14")}
                    </small>
                    {line.autoRenew && (
                      <small>
                        {run("gl_commerce|purchaseCheckout-section-1|td", 0)}
                        {termLabel(line.months)}
                        {run(
                          "gl_commerce|purchaseCheckout-section-1|td-2",
                          0,
                        )}{" "}
                        {receiptMoney(line.total)}
                      </small>
                    )}
                  </td>
                  <td>
                    {receiptMoney(line.total)}
                    <small>
                      {line.discount}% {line.reason}
                      {run("gl_commerce|purchaseCheckout-section-1|td-3", 0)}
                    </small>
                  </td>
                </tr>
              )),
            )}
          </tbody>
          <tfoot>
            {order.quote.tax > 0 && (
              <tr>
                <th>{taxCaption(order)}</th>
                <td>{receiptMoney(order.quote.tax)}</td>
              </tr>
            )}
            <tr>
              <th>{run("gl_commerce|purchaseCheckout-section-1|th-3", 0)}</th>
              <th>{receiptMoney(order.quote.total)}</th>
            </tr>
          </tfoot>
        </table>
        <p>{run("gl_commerce|purchaseCheckout-section-1|p", 0)}</p>
      </section>
      <PurchaseDialog
        open={handoff}
        title={msg("PurchaseSetup:1")}
        onClose={() => {
          if (!busy) {
            passwordField.current?.form?.reset();
            setAccountError("");
            setExistingAccount(false);
            setHandoff(false);
          }
        }}
        descriptionId="purchase-setup-description"
      >
        <p id="purchase-setup-description">
          {msg("PurchaseSetup:2", [customer?.email || ""])}
        </p>
        {signedIn ? (
          <PurchaseAction onClick={openAccount} disabled={busy}>
            {busy ? msg("PurchaseCheckout:8") : msg("PurchaseSetup:5")}
          </PurchaseAction>
        ) : (
          <form
            className="purchase-account-setup"
            onSubmit={setupAccount}
            noValidate
            aria-busy={busy}
          >
            <label>
              {msg("PurchaseSetup:3")}
              <input
                ref={passwordField}
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={busy}
                aria-invalid={!!accountError}
                aria-describedby={
                  accountError
                    ? "purchase-setup-hint purchase-setup-error"
                    : "purchase-setup-hint"
                }
              />
            </label>
            <label>
              {msg("PurchaseSetup:10")}
              <input
                ref={confirmationField}
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={busy}
                aria-invalid={!!accountError}
                aria-describedby={
                  accountError ? "purchase-setup-error" : undefined
                }
              />
            </label>
            <p className="purchase-caption" id="purchase-setup-hint">
              {msg("PurchaseSetup:4")}
            </p>
            <PurchaseAction type="submit" disabled={busy || existingAccount}>
              {busy ? msg("PurchaseCheckout:8") : msg("PurchaseSetup:5")}
            </PurchaseAction>
          </form>
        )}
        {accountError && (
          <p id="purchase-setup-error" className="purchase-error" role="alert">
            {accountError}
          </p>
        )}
        {existingAccount && (
          <PurchaseAction href="/sign-in" secondary>
            {msg("PurchaseSetup:9")}
          </PurchaseAction>
        )}
        {!customer?.email && (
          <PurchaseAction href="/sign-up" secondary>
            {msg("PurchaseCheckout:7")}
          </PurchaseAction>
        )}
      </PurchaseDialog>
    </div>
  );
}
export default function PurchaseCheckout() {
  const { items } = useCart();
  const pricing = useSyncExternalStore(
    subscribePricing,
    getPricingSnapshot,
    getPricingSnapshot,
  );
  const [initialAttempt] = useState(() => getPendingPayment());
  const [quoted, setQuoted] = useState(initialAttempt?.quote || null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quoteRefresh, setQuoteRefresh] = useState(0);
  const recovering = getPendingPayment();
  const orderGroups = recovering?.quote.groups || items;
  const configuration = purchaseFingerprint(orderGroups);
  const identity = useSyncExternalStore(
    subscribePreviewCustomer,
    getPreviewCustomer,
    getPreviewCustomer,
  );
  const [saved] = useState(() => (items.length ? null : loadPurchaseSession()));
  const [order, setOrder] = useState(saved?.order || null);
  const [crm, setCRM] = useState(
    saved?.crm || { status: "pending", access: "setup-required" },
  );
  const [customer, setCustomer] = useState(
    () =>
      saved?.customer ||
      initialAttempt?.payload.billing ||
      (identity ? { ...identity } : { name: "", email: "", company: "" }),
  );
  const verified =
    !!identity && customer.email.toLowerCase() === identity.email.toLowerCase();
  const guestDraft = useRef({ name: "", email: "", company: "" });
  const previousIdentity = useRef(identity);
  useEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    if (!order && !getPendingPayment())
      setCustomer(identity ? { ...identity } : { ...guestDraft.current });
    setErrors({});
  }, [identity, order]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(
    initialAttempt ? msg("PlatformPricing:16") : "",
  );
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(
    initialAttempt?.payload.paymentMethod || null,
  );
  const [paymentDetails, setPaymentDetails] = useState({});
  const selectedMethod = paymentMethod ? getPaymentMethod(paymentMethod) : null;
  const paymentReady =
    !!recovering ||
    (!!selectedMethod &&
      !Object.keys(validateTestPaymentDetails(paymentMethod, paymentDetails))
        .length);
  const [outcome, setOutcome] = useState("success");
  const [crmScenario, setCRMScenario] = useState("ready");
  const [sessionSaved, setSessionSaved] = useState(true);
  const showTestControls =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("qa") === "1";
  const busy = useRef(false);
  const controller = useRef(null);
  const attempt = useRef(initialAttempt?.payload.reference || null);
  const approvalCart = useRef(items);
  const form = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (order || getPendingPayment()) return;
    if (pricing.status !== "ready" || !quoteCart(items).valid) {
      setQuoted(null);
      setQuoting(false);
      return;
    }
    const request = new AbortController();
    setQuoting(true);
    setQuoted(null);
    setQuoteError("");
    quoteWebsite({ groups: items, signal: request.signal })
      .then((value) => {
        if (!request.signal.aborted) setQuoted(value);
      })
      .catch((problem) => {
        if (!request.signal.aborted) setQuoteError(purchaseErrorText(problem));
      })
      .finally(() => {
        if (!request.signal.aborted) setQuoting(false);
      });
    return () => request.abort();
  }, [configuration, pricing.version, quoteRefresh, order]);
  useEffect(() => {
    if (!quoted || order || getPendingPayment()) return;
    const timer = setTimeout(
      () => {
        if (getPendingPayment()) return;
        attempt.current = null;
        setError(msg("PlatformPricing:5"));
        setQuoteRefresh((value) => value + 1);
      },
      (quoted.expiresIn || 900) * 1000,
    );
    return () => clearTimeout(timer);
  }, [quoted, order]);
  useEffect(() => {
    if (
      !recovering &&
      paymentMethod &&
      pricing.paymentMethods &&
      !pricing.paymentMethods.includes(paymentMethod)
    ) {
      setPaymentMethod(null);
      setPaymentDetails({});
    }
  }, [pricing.version, paymentMethod, recovering]);
  useEffect(() => {
    if (approvalCart.current === items) return;
    approvalCart.current = items;
    if (!order) {
      controller.current?.abort();
      if (!getPendingPayment()) attempt.current = null;
      setPaymentDetails({});
      setErrors({});
    }
  }, [items, order]);
  const updateCRM = (value) => {
    setCRM(value);
    if (order) setSessionSaved(savePurchaseSession(order, value, customer));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy.current) return;
    const problems = recovering
      ? {}
      : {
          ...validateCustomer(customer),
          ...(selectedMethod
            ? validateTestPaymentDetails(paymentMethod, paymentDetails)
            : { paymentMethod: msg("PurchaseCheckout:17") }),
        };
    setErrors(problems);
    setError("");
    if (Object.keys(problems).length) {
      const firstError = Object.keys(problems)[0];
      if (firstError === "paymentMethod")
        form.current?.querySelector('[name="paymentMethod"]')?.focus();
      else form.current?.elements[firstError]?.focus();
      return;
    }
    if (!quoted || quoting || (!recovering && !quoteCart(items).valid)) {
      setError(msg("PurchaseCheckout:18"));
      return;
    }
    busy.current = true;
    setProcessing(true);
    controller.current = new AbortController();
    if (recovering) attempt.current = recovering.payload.reference;
    attempt.current ||= `ORG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      const purchase = await simulatePayment({
        groups: orderGroups,
        customer,
        reference: attempt.current,
        paymentMethod: recovering?.payload.paymentMethod || paymentMethod,
        quote: quoted,
        authorization: recovering
          ? { method: recovering.payload.paymentMethod, approved: true }
          : createTestPaymentAuthorization(paymentMethod, paymentDetails),
        outcome,
        signal: controller.current.signal,
      });
      const pending = {
        status: "pending",
        access: verified ? "verified-existing" : "setup-required",
      };
      setPaymentDetails({});
      setOrder(purchase);
      setCRM(pending);
      setSessionSaved(savePurchaseSession(purchase, pending, customer));
      completeCartPurchase(
        purchase.groups
          .filter((group) =>
            getCartSnapshot().items.some(
              (current) =>
                current.id === group.id &&
                groupFingerprint(current) === groupFingerprint(group),
            ),
          )
          .map((group) => group.id),
      );
      dismissCartNotice();
      const setup = await setupInSuite(purchase, {
        scenario: crmScenario,
        verified,
        customer,
      });
      setCRM(setup);
      setSessionSaved(savePurchaseSession(purchase, setup, customer));
    } catch (problem) {
      if (paymentMethod !== "card") setPaymentDetails({});
      setError(purchaseErrorText(problem));
      if (problem.confirmed || problem.code === "quote_expired")
        attempt.current = null;
      if (problem.code === "quote_expired")
        setQuoteRefresh((value) => value + 1);
    } finally {
      busy.current = false;
      setProcessing(false);
    }
  };
  const field = (id, label, type = "text", required = true) => (
    <label key={id}>
      {label}
      {required ? " *" : msg("PurchaseCheckout:21")}
      <input
        name={id}
        type={type}
        maxLength={id === "email" ? 254 : 200}
        autoComplete={id === "company" ? "organization" : id}
        value={customer[id]}
        readOnly={verified && id === "email"}
        onChange={(e) => {
          setCustomer({ ...customer, [id]: e.target.value });
        }}
        required={required}
        aria-invalid={!!errors[id]}
        aria-describedby={errors[id] ? "payment-" + id + "-error" : undefined}
      />
      {errors[id] && (
        <span className="purchase-error" id={`payment-${id}-error`}>
          {errors[id]}
        </span>
      )}
    </label>
  );
  return (
    <CommerceLayout checkout complete={!!order}>
      <div className="purchase-surface">
        <div className="commerce-intro">
          <span className="purchase-eyebrow">
            {order ? msg("PurchaseCheckout:23") : msg("PurchaseCheckout:24")}
          </span>
          <h1>
            {order ? msg("PurchaseCheckout:25") : msg("PurchaseCheckout:26")}
          </h1>
          <p>
            {order ? msg("PurchaseCheckout:27") : msg("PurchaseCheckout:28")}
          </p>
        </div>
        {!sessionSaved && (
          <p className="purchase-alert">
            {run("gl_commerce|purchaseCheckout-intro|p", 0)}
          </p>
        )}
        {order ? (
          <Confirmation
            order={order}
            crm={crm}
            onCRM={updateCRM}
            customer={customer}
            onRestart={() => {
              clearPurchaseSession();
              window.__orgNav?.("/plans");
            }}
          />
        ) : !orderGroups.length ? (
          <EmptyPurchaseCart />
        ) : (
          <div className="purchase-layout purchase-checkout-layout">
            <details className="purchase-mobile-order">
              <summary>
                <span>
                  {run("gl_commerce|purchaseCheckout-intro|summary", 0)}{" "}
                  {orderGroups.reduce((n, g) => n + g.lines.length, 0)}
                  {run("gl_commerce|purchaseCheckout-intro|summary-2", 0)}
                  <strong>
                    {money(quoted?.quote.total, quoted)}
                    {run("gl_commerce|purchaseCheckout-intro|summary-3", 0)}
                  </strong>
                </span>
                <i className="ph ph-caret-down" aria-hidden="true" />
              </summary>
              <OrderContents groups={orderGroups} pricedQuote={quoted} />
              <p>
                {run("gl_commerce|purchaseCheckout-intro|p-2", 0)}{" "}
                {money(quoted?.quote.saving, quoted)}
                {run("gl_commerce|purchaseCheckout-intro|p-3", 0)}
              </p>
              <a href="/cart">
                {run("gl_commerce|purchaseCheckout-intro|a", 0)}
              </a>
            </details>
            <section className="purchase-checkout-panel">
              <form
                ref={form}
                onSubmit={submit}
                noValidate
                aria-busy={processing}
              >
                <div className="purchase-checkout-identity">
                  <div>
                    <strong>
                      {verified
                        ? msg("PurchaseCheckout:29", [
                            identity.name || identity.email,
                          ])
                        : msg("PurchaseCheckout:30")}
                    </strong>
                    {verified && <span>{identity.email}</span>}
                  </div>
                  {verified && (
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => {
                        signOutPreviewCustomer();
                        setCustomer({ ...guestDraft.current });
                        setErrors({});
                      }}
                    >
                      {run("gl_commerce|purchaseCheckout-section-2|button", 0)}
                    </button>
                  )}
                </div>
                <h2>{run("gl_commerce|purchaseCheckout-section-2|h2", 0)}</h2>
                <p>
                  {verified
                    ? msg("PurchaseCheckout:31")
                    : msg("PurchaseCheckout:32")}
                </p>
                <fieldset
                  disabled={processing || !!recovering}
                  className="purchase-billing-fields"
                >
                  <div className="purchase-fields">
                    {field("name", msg("PurchaseCheckout:33"))}
                    {field("email", msg("PurchaseCheckout:34"), "email")}
                    <details className="purchase-company">
                      <summary>
                        {run(
                          "gl_commerce|purchaseCheckout-section-2|summary",
                          0,
                        )}
                      </summary>
                      {field(
                        "company",
                        msg("PurchaseCheckout:35"),
                        "text",
                        false,
                      )}
                    </details>
                  </div>
                </fieldset>
                <fieldset
                  className="purchase-payment-methods"
                  disabled={processing || !!recovering}
                  aria-describedby="purchase-payment-disclosure"
                >
                  <legend>
                    {run("gl_commerce|purchaseCheckout-section-2|legend", 0)}
                  </legend>
                  <div className="purchase-payment-options">
                    {PAYMENT_METHODS.filter(
                      (method) =>
                        !pricing.paymentMethods ||
                        method.id === recovering?.payload.paymentMethod ||
                        pricing.paymentMethods.includes(method.id),
                    ).map((method) => (
                      <label
                        className="purchase-payment-option"
                        key={method.id}
                        data-selected={paymentMethod === method.id}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={paymentMethod === method.id}
                          onChange={() => {
                            if (method.id === paymentMethod) return;
                            setPaymentMethod(method.id);
                            setPaymentDetails({});
                            setErrors({});
                            setError("");
                          }}
                          aria-label={method.name}
                          aria-describedby={`purchase-method-${method.id}-description`}
                        />
                        <i
                          className={`ph ph-${method.icon}`}
                          aria-hidden="true"
                        />
                        <span>
                          <strong>{method.name}</strong>
                          <small
                            id={`purchase-method-${method.id}-description`}
                          >
                            {method.description}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedMethod && (
                    <p className="purchase-payment-guidance" role="status">
                      {selectedMethod.guidance}
                    </p>
                  )}
                </fieldset>
                {paymentMethod === "card" && !recovering && (
                  <PaymentDetails
                    details={paymentDetails}
                    onChange={setPaymentDetails}
                    errors={errors}
                    onErrors={setErrors}
                    processing={processing}
                  />
                )}
                <div className="purchase-payment-total">
                  <span>
                    {run("gl_commerce|purchaseCheckout-section-2|div", 0)}
                  </span>
                  <strong>{money(quoted?.quote.total, quoted)}</strong>
                </div>
                <PurchasePriceStatus source={quoted} />
                {quoting ? (
                  <p className="purchase-caption" role="status">
                    {msg("PlatformPricing:4")}
                  </p>
                ) : null}
                {quoteError ? (
                  <p className="purchase-error" role="alert">
                    {quoteError}{" "}
                    <button
                      type="button"
                      className="purchase-text-button"
                      onClick={() => setQuoteRefresh((value) => value + 1)}
                    >
                      {msg("PlatformPricing:3")}
                    </button>
                  </p>
                ) : null}
                <p
                  id="purchase-payment-disclosure"
                  className="purchase-payment-disclosure"
                >
                  {run("gl_commerce|purchaseCheckout-section-2|p", 0)}
                </p>
                {error && (
                  <p className="purchase-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={
                    processing ||
                    quoting ||
                    !quoted ||
                    !quoted.quote.valid ||
                    (!recovering && !quoteCart(items).valid) ||
                    !paymentReady
                  }
                  className="commerce-action purchase-action"
                >
                  <span>
                    {processing && selectedMethod
                      ? msg("PurchaseCheckout:37", [selectedMethod.name])
                      : recovering
                        ? msg("PlatformPricing:19")
                        : msg("PurchaseCheckout:38", [
                            money(quoted?.quote.total, quoted),
                          ])}
                  </span>
                  <span className="commerce-action__arrow">
                    <i className="ph ph-lock-simple" aria-hidden="true" />
                  </span>
                </button>
                <span className="purchase-sr-only" role="status">
                  {processing ? msg("PurchaseCheckout:39") : ""}
                </span>
                {processing && (
                  <button
                    type="button"
                    className="purchase-text-button"
                    onClick={() => controller.current?.abort()}
                  >
                    {run("gl_commerce|purchaseCheckout-section-2|button-2", 0)}
                  </button>
                )}
                {!recovering && !quoteCart(items).valid && (
                  <p className="purchase-error">
                    {run("gl_commerce|purchaseCheckout-section-2|p-2", 0)}{" "}
                    <a href="/cart">
                      {run("gl_commerce|purchaseCheckout-section-2|a", 0)}
                    </a>
                    .
                  </p>
                )}
                {showTestControls && (
                  <details className="purchase-demo-controls">
                    <summary>
                      {run(
                        "gl_commerce|purchaseCheckout-section-2|summary-2",
                        0,
                      )}
                    </summary>
                    <div className="purchase-fields">
                      <label>
                        {run("gl_commerce|purchaseCheckout-section-2|label", 0)}
                        <select
                          disabled={processing}
                          value={outcome}
                          onChange={(e) => setOutcome(e.target.value)}
                        >
                          <option value="success">
                            {run(
                              "gl_commerce|purchaseCheckout-section-2|option",
                              0,
                            )}
                          </option>
                          <option value="declined">
                            {run(
                              "gl_commerce|purchaseCheckout-section-2|option-2",
                              0,
                            )}
                          </option>
                          <option value="cancelled">
                            {run(
                              "gl_commerce|purchaseCheckout-section-2|option-3",
                              0,
                            )}
                          </option>
                        </select>
                      </label>
                      <label>
                        {run(
                          "gl_commerce|purchaseCheckout-section-2|label-2",
                          0,
                        )}
                        <select
                          disabled={processing}
                          value={crmScenario}
                          onChange={(e) => setCRMScenario(e.target.value)}
                        >
                          <option value="ready">
                            {run(
                              "gl_commerce|purchaseCheckout-section-2|option-4",
                              0,
                            )}
                          </option>
                          <option value="pending">
                            {run(
                              "gl_commerce|purchaseCheckout-section-2|option-5",
                              0,
                            )}
                          </option>
                          <option value="failed">
                            {run(
                              "gl_commerce|purchaseCheckout-section-2|option-6",
                              0,
                            )}
                          </option>
                        </select>
                      </label>
                    </div>
                  </details>
                )}
              </form>
            </section>
            <QuoteSummary
              groups={orderGroups}
              pricedQuote={quoted}
              title={attr(
                "gl_commerce|purchaseCheckout-intro|QuoteSummary@title",
              )}
            >
              <OrderContents groups={orderGroups} pricedQuote={quoted} />
              <a href="/cart">
                {run("gl_commerce|purchaseCheckout-intro|a-2", 0)}
              </a>
            </QuoteSummary>
          </div>
        )}
        <PreviewNote source={order || quoted} />
      </div>
    </CommerceLayout>
  );
}
