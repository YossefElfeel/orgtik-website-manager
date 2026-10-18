import React from "react";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings.js";

import {
  normalizeTestPaymentInput,
  TEST_CARD_NUMBERS,
  TEST_CARD_EXPIRY,
  TEST_CARD_SECURITY_CODE,
  validateTestPaymentDetails,
} from "./purchase-payment.js";

export function PaymentDetails({
  details,
  onChange,
  errors,
  onErrors,
  processing,
}) {
  const ready = !Object.keys(validateTestPaymentDetails("card", details))
    .length;
  const cardField = (id, label, placeholder, length) => (
    <label key={id}>
      {label} *
      <input
        name={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={length}
        placeholder={placeholder}
        value={details[id] || ""}
        required
        aria-label={`${label} *`}
        aria-invalid={!!errors[id]}
        aria-describedby={`test-payment-notice${errors[id] ? ` ${id}-error` : ""}`}
        onChange={(event) => {
          const value = normalizeTestPaymentInput(id, event.target.value);
          if (value === null) {
            event.target.value = details[id] || "";
            onErrors({
              ...errors,
              [id]: invalidTestDetails(),
            });
            return;
          }
          onChange({ ...details, [id]: value });
          onErrors({ ...errors, [id]: undefined });
        }}
        onBlur={() =>
          onErrors({
            ...errors,
            [id]: validateTestPaymentDetails("card", details)[id],
          })
        }
      />
      {errors[id] && (
        <span className="purchase-error" id={`${id}-error`}>
          {errors[id]}
        </span>
      )}
    </label>
  );
  return (
    <fieldset className="purchase-payment-details" disabled={processing}>
      <legend>{run("gl_commerce|paymentDetails-intro|legend", 0)}</legend>
      <p id="test-payment-notice" className="purchase-test-payment-note">
        {run("gl_commerce|paymentDetails-intro|p", 0, [
          TEST_CARD_NUMBERS[0].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_NUMBERS[1].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_EXPIRY,
          TEST_CARD_SECURITY_CODE,
        ])}
        <strong>
          {run("gl_commerce|paymentDetails-intro|p", 1, [
            TEST_CARD_NUMBERS[0].replace(/(.{4})(?=.)/g, "$1 "),
            TEST_CARD_NUMBERS[1].replace(/(.{4})(?=.)/g, "$1 "),
            TEST_CARD_EXPIRY,
            TEST_CARD_SECURITY_CODE,
          ])}
        </strong>
        {run("gl_commerce|paymentDetails-intro|p", 2, [
          TEST_CARD_NUMBERS[0].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_NUMBERS[1].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_EXPIRY,
          TEST_CARD_SECURITY_CODE,
        ])}
        {run("gl_commerce|paymentDetails-intro|p", 3, [
          TEST_CARD_NUMBERS[0].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_NUMBERS[1].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_EXPIRY,
          TEST_CARD_SECURITY_CODE,
        ])}
        <strong>
          {run("gl_commerce|paymentDetails-intro|p", 5, [
            TEST_CARD_NUMBERS[0].replace(/(.{4})(?=.)/g, "$1 "),
            TEST_CARD_NUMBERS[1].replace(/(.{4})(?=.)/g, "$1 "),
            TEST_CARD_EXPIRY,
            TEST_CARD_SECURITY_CODE,
          ])}
        </strong>
        {run("gl_commerce|paymentDetails-intro|p", 6, [
          TEST_CARD_NUMBERS[0].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_NUMBERS[1].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_EXPIRY,
          TEST_CARD_SECURITY_CODE,
        ])}
        <strong>
          {run("gl_commerce|paymentDetails-intro|p", 7, [
            TEST_CARD_NUMBERS[0].replace(/(.{4})(?=.)/g, "$1 "),
            TEST_CARD_NUMBERS[1].replace(/(.{4})(?=.)/g, "$1 "),
            TEST_CARD_EXPIRY,
            TEST_CARD_SECURITY_CODE,
          ])}
        </strong>
        {run("gl_commerce|paymentDetails-intro|p", 8, [
          TEST_CARD_NUMBERS[0].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_NUMBERS[1].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_EXPIRY,
          TEST_CARD_SECURITY_CODE,
        ])}
        <strong>
          {run("gl_commerce|paymentDetails-intro|p", 9, [
            TEST_CARD_NUMBERS[0].replace(/(.{4})(?=.)/g, "$1 "),
            TEST_CARD_NUMBERS[1].replace(/(.{4})(?=.)/g, "$1 "),
            TEST_CARD_EXPIRY,
            TEST_CARD_SECURITY_CODE,
          ])}
        </strong>
        {run("gl_commerce|paymentDetails-intro|p", 10, [
          TEST_CARD_NUMBERS[0].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_NUMBERS[1].replace(/(.{4})(?=.)/g, "$1 "),
          TEST_CARD_EXPIRY,
          TEST_CARD_SECURITY_CODE,
        ])}
      </p>
      <div className="purchase-fields purchase-card-fields">
        {cardField(
          "cardNumber",
          msg("PaymentDetails:1"),
          "4242 4242 4242 4242",
          19,
        )}
        {cardField("expiry", msg("PaymentDetails:2"), "12/30", 5)}
        {cardField("securityCode", msg("PaymentDetails:3"), "123", 3)}
      </div>
      <button
        type="button"
        className="purchase-text-button"
        onClick={() => {
          onChange({
            cardNumber: TEST_CARD_NUMBERS[0].replace(/(.{4})(?=.)/g, "$1 "),
            expiry: TEST_CARD_EXPIRY,
            securityCode: TEST_CARD_SECURITY_CODE,
          });
          onErrors({
            ...errors,
            cardNumber: undefined,
            expiry: undefined,
            securityCode: undefined,
          });
        }}
      >
        {run("gl_commerce|paymentDetails-intro|button", 0)}
      </button>
      <p
        className={`purchase-payment-readiness${ready ? " purchase-payment-readiness--ready" : ""}`}
        role="status"
      >
        {ready ? msg("PaymentDetails:4") : msg("PaymentDetails:5")}
      </p>
    </fieldset>
  );
}

function invalidTestDetails() {
  return msg("PaymentDetails:6");
}
