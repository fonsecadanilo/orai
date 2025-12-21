/**
 * Tests for Agent 5: UX Block Composer
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  adaptBlockForContext,
  generateDefaultInputs,
} from "@/lib/agents/v3/ux-block-composer-v3";
import type { AdaptedUXBlockV3, ProductContext } from "@/lib/agents/v3/types";

describe("UX Block Composer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("adaptBlockForContext", () => {
    it("should mark block as adapted", () => {
      const originalBlock: Partial<AdaptedUXBlockV3> = {
        block_id: "test_block",
        block_type: "form",
        title: "Test Form",
        input_fields: [],
        actions: [],
        impact_level: "medium",
      };

      const result = adaptBlockForContext(originalBlock, {
        productType: "saas",
        roleId: "user",
      });

      expect(result.adapted).toBe(true);
      expect(result.original_block_id).toBe("test_block");
    });

    it("should add extra validation for fintech emails", () => {
      const originalBlock: Partial<AdaptedUXBlockV3> = {
        block_id: "email_block",
        block_type: "form",
        title: "Email Form",
        input_fields: [
          {
            field_name: "email",
            field_type: "email",
            label: "Email",
            required: true,
            validation_rules: ["email"],
          },
        ],
        actions: [],
        impact_level: "medium",
      };

      const result = adaptBlockForContext(originalBlock, {
        productType: "fintech",
        roleId: "user",
      });

      const emailField = result.input_fields?.find(f => f.field_name === "email");
      expect(emailField?.validation_rules).toContain("corporate_email_preferred");
      expect(emailField?.tooltip).toBeDefined();
    });

    it("should add privacy tooltips for healthcare", () => {
      const originalBlock: Partial<AdaptedUXBlockV3> = {
        block_id: "health_block",
        block_type: "form",
        title: "Patient Form",
        input_fields: [
          {
            field_name: "name",
            field_type: "text",
            label: "Name",
            required: true,
            validation_rules: [],
          },
        ],
        actions: [],
        impact_level: "medium",
      };

      const result = adaptBlockForContext(originalBlock, {
        productType: "healthtech",
        roleId: "user",
      });

      const nameField = result.input_fields?.find(f => f.field_name === "name");
      expect(nameField?.tooltip).toContain("LGPD");
    });

    it("should add admin notes field for admin role", () => {
      const originalBlock: Partial<AdaptedUXBlockV3> = {
        block_id: "admin_block",
        block_type: "form",
        title: "Admin Form",
        input_fields: [
          {
            field_name: "data",
            field_type: "text",
            label: "Data",
            required: true,
            validation_rules: [],
          },
        ],
        actions: [],
        impact_level: "medium",
      };

      const result = adaptBlockForContext(originalBlock, {
        productType: "saas",
        roleId: "admin",
      });

      const notesField = result.input_fields?.find(f => f.field_name === "internal_notes");
      expect(notesField).toBeDefined();
      expect(notesField?.required).toBe(false);
    });

    it("should ensure primary action exists", () => {
      const originalBlock: Partial<AdaptedUXBlockV3> = {
        block_id: "no_action_block",
        block_type: "form",
        title: "Form",
        input_fields: [],
        actions: [], // No actions
        impact_level: "medium",
      };

      const result = adaptBlockForContext(originalBlock, {
        productType: "saas",
        roleId: "user",
      });

      expect(result.actions?.some(a => a.action_type === "primary")).toBe(true);
    });

    it("should add cancel action if missing", () => {
      const originalBlock: Partial<AdaptedUXBlockV3> = {
        block_id: "submit_only_block",
        block_type: "form",
        title: "Form",
        input_fields: [],
        actions: [
          { action_id: "submit", label: "Submit", action_type: "primary" },
        ],
        impact_level: "medium",
      };

      const result = adaptBlockForContext(originalBlock, {
        productType: "saas",
        roleId: "user",
      });

      expect(result.actions?.some(a => a.action_type === "secondary")).toBe(true);
    });
  });

  describe("generateDefaultInputs", () => {
    it("should generate login inputs", () => {
      const inputs = generateDefaultInputs("login", "saas");

      expect(inputs).toHaveLength(2);
      expect(inputs.find(i => i.field_type === "email")).toBeDefined();
      expect(inputs.find(i => i.field_type === "password")).toBeDefined();
    });

    it("should generate signup inputs with name", () => {
      const inputs = generateDefaultInputs("signup", "saas");

      expect(inputs.find(i => i.field_name === "name")).toBeDefined();
      expect(inputs.find(i => i.field_name === "email")).toBeDefined();
      expect(inputs.find(i => i.field_name === "password")).toBeDefined();
    });

    it("should add CPF field for fintech signup", () => {
      const inputs = generateDefaultInputs("signup", "fintech");

      const cpfField = inputs.find(i => i.field_name === "cpf");
      expect(cpfField).toBeDefined();
      expect(cpfField?.validation_rules).toContain("cpf_valid");
    });

    it("should add phone field for e-commerce signup", () => {
      const inputs = generateDefaultInputs("signup", "e-commerce");

      const phoneField = inputs.find(i => i.field_name === "phone");
      expect(phoneField).toBeDefined();
      expect(phoneField?.required).toBe(false);
    });

    it("should generate contact form inputs", () => {
      const inputs = generateDefaultInputs("contact", "saas");

      expect(inputs.find(i => i.field_name === "name")).toBeDefined();
      expect(inputs.find(i => i.field_name === "email")).toBeDefined();
      expect(inputs.find(i => i.field_name === "message")).toBeDefined();
    });

    it("should return empty array for unknown form type", () => {
      const inputs = generateDefaultInputs("unknown_type", "saas");

      expect(inputs).toHaveLength(0);
    });
  });
});







