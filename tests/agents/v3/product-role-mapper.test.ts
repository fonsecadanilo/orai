/**
 * Tests for Agent 1: Product & Role Mapper
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase/client";
import {
  mapProductAndRole,
  getProductContextFromProject,
} from "@/lib/agents/v3/product-role-mapper";
import type { ProductRoleMapperResponse } from "@/lib/agents/v3/types";

describe("Product & Role Mapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("mapProductAndRole", () => {
    it("should successfully map product and roles from prompt", async () => {
      const mockResponse: ProductRoleMapperResponse = {
        success: true,
        product_context: {
          product_name: "Test SaaS",
          product_type: "saas",
          business_model: "b2b",
          main_value_proposition: "Testing platform",
          key_features: ["feature1", "feature2"],
          target_audience: "Developers",
          maturity_stage: "growth",
        },
        roles: [
          {
            role_id: "admin",
            role_name: "admin",
            role_scope: "admin",
            permissions: ["manage_users", "manage_settings"],
            restrictions: [],
            typical_goals: ["Configure system"],
            pain_points: ["Complex UI"],
          },
          {
            role_id: "member",
            role_name: "member",
            role_scope: "member",
            permissions: ["view_own", "edit_own"],
            restrictions: ["cannot_delete_others"],
            typical_goals: ["Complete tasks"],
            pain_points: ["Limited access"],
          },
        ],
        primary_role: "member",
        analysis: {
          detected_product_type: "saas",
          detected_roles_count: 2,
          confidence_score: 0.9,
          suggestions: [],
        },
        message: "Mapeamento completo",
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await mapProductAndRole({
        prompt: "Crie um fluxo de login para um SaaS B2B",
        project_id: 1,
        user_id: 1,
      });

      expect(result.success).toBe(true);
      expect(result.product_context.product_type).toBe("saas");
      expect(result.roles).toHaveLength(2);
      expect(result.primary_role).toBe("member");
    });

    it("should throw error when Edge Function fails", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: "Network error" } as any,
      });

      await expect(
        mapProductAndRole({
          prompt: "Test prompt",
          project_id: 1,
          user_id: 1,
        })
      ).rejects.toMatchObject({
        code: "EDGE_FUNCTION_ERROR",
      });
    });

    it("should throw error when response is empty", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        mapProductAndRole({
          prompt: "Test prompt",
          project_id: 1,
          user_id: 1,
        })
      ).rejects.toMatchObject({
        code: "EMPTY_RESPONSE",
      });
    });

    it("should throw error when success is false", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: false, message: "Agent error" },
        error: null,
      });

      await expect(
        mapProductAndRole({
          prompt: "Test prompt",
          project_id: 1,
          user_id: 1,
        })
      ).rejects.toMatchObject({
        code: "AGENT_ERROR",
      });
    });
  });

  describe("getProductContextFromProject", () => {
    it("should return product context from project metadata", async () => {
      const mockProject = {
        name: "My Project",
        description: "A test project",
        metadata: {
          product_context: {
            product_name: "Test Product",
            product_type: "fintech",
          },
        },
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      } as any);

      const result = await getProductContextFromProject(1);

      expect(result).toEqual({
        product_name: "Test Product",
        product_type: "fintech",
      });
    });

    it("should return basic context when no product_context in metadata", async () => {
      const mockProject = {
        name: "My Project",
        description: "A test project",
        metadata: {},
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      } as any);

      const result = await getProductContextFromProject(1);

      expect(result).toEqual({
        product_name: "My Project",
        main_value_proposition: "A test project",
      });
    });

    it("should return null when project not found", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
      } as any);

      const result = await getProductContextFromProject(999);

      expect(result).toBeNull();
    });
  });
});







