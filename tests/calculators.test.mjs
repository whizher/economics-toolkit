import assert from "node:assert/strict";
import test from "node:test";

import {
  cagr,
  compoundProjection,
  inflationEquivalent,
  nominalToReal,
  percentageChange,
  purchasingPower,
  realToNominal,
} from "../src/calculators.mjs";

const closeTo = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

test("percentageChange measures increases and decreases", () => {
  closeTo(percentageChange(100, 125), 25);
  closeTo(percentageChange(250, 200), -20);
});

test("percentageChange rejects a zero starting value", () => {
  assert.throws(() => percentageChange(0, 10), /cannot be zero/);
});

test("cagr returns a smoothed annual rate", () => {
  closeTo(cagr(100, 161.051, 5), 10, 1e-6);
  closeTo(cagr(100, 100, 10), 0);
});

test("cagr validates its economic domain", () => {
  assert.throws(() => cagr(0, 100, 5), /greater than zero/);
  assert.throws(() => cagr(100, -1, 5), /cannot be negative/);
  assert.throws(() => cagr(100, 120, 0), /greater than zero/);
});

test("inflation calculations are reciprocal", () => {
  const equivalent = inflationEquivalent(1_000_000, 3, 5);
  closeTo(equivalent, 1_159_274.0743, 1e-4);
  closeTo(purchasingPower(equivalent, 3, 5), 1_000_000, 1e-6);
});

test("inflation calculations reject an impossible rate", () => {
  assert.throws(() => inflationEquivalent(100, -100, 1), /greater than/);
});

test("nominal and real conversions are reciprocal", () => {
  closeTo(nominalToReal(125_000_000, 125, 100), 100_000_000);
  closeTo(realToNominal(100_000_000, 125, 100), 125_000_000);
});

test("compoundProjection grows a balance", () => {
  const result = compoundProjection(100, 10, 2);
  closeTo(result.finalValue, 121);
  closeTo(result.totalAdded, 100);
  closeTo(result.totalGrowth, 21);
  assert.equal(result.rows.length, 3);
});

test("compoundProjection adds contributions after each period's growth", () => {
  const result = compoundProjection(100, 10, 2, 10);
  closeTo(result.rows[1].balance, 120);
  closeTo(result.finalValue, 142);
  closeTo(result.totalAdded, 120);
  closeTo(result.totalGrowth, 22);
});

test("compoundProjection limits projections to whole periods", () => {
  assert.throws(() => compoundProjection(100, 5, 2.5), /whole number/);
  assert.throws(() => compoundProjection(100, 5, 101), /1 to 100/);
});
