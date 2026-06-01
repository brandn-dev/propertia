import test from "node:test";
import assert from "node:assert/strict";
import { getCosaTemplatePreset } from "@/lib/billing/cosa-presets";

test("generator fuel preset exists with manual flexible defaults", () => {
  const preset = getCosaTemplatePreset("generator-fuel");

  assert.ok(preset);
  assert.equal(preset.id, "generator-fuel");
  assert.equal(preset.label, "Generator Fuel");
  assert.equal(preset.name, "Generator Fuel");
  assert.equal(preset.allocationType, "PER_UNIT");
  assert.equal(preset.utilityType, undefined);
  assert.equal(preset.sourceHint, "Manual amount + flexible split");
  assert.match(preset.description, /generator fuel/i);
});
