export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          approver_id: string | null
          created_at: string
          created_by: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string
          department_id: string | null
          evidence_checksum: string | null
          evidence_document_id: string | null
          evidence_is_na: boolean
          evidence_record_id: string | null
          evidence_requirement: string | null
          evidence_revision: string | null
          id: string
          organization_id: string
          outcome: Database["public"]["Enums"]["approval_outcome"]
          protected_action: boolean
          record_id: string | null
          reviewer_department_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          created_by: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string
          department_id?: string | null
          evidence_checksum?: string | null
          evidence_document_id?: string | null
          evidence_is_na?: boolean
          evidence_record_id?: string | null
          evidence_requirement?: string | null
          evidence_revision?: string | null
          id?: string
          organization_id: string
          outcome?: Database["public"]["Enums"]["approval_outcome"]
          protected_action?: boolean
          record_id?: string | null
          reviewer_department_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          created_by?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string
          department_id?: string | null
          evidence_checksum?: string | null
          evidence_document_id?: string | null
          evidence_is_na?: boolean
          evidence_record_id?: string | null
          evidence_requirement?: string | null
          evidence_revision?: string | null
          id?: string
          organization_id?: string
          outcome?: Database["public"]["Enums"]["approval_outcome"]
          protected_action?: boolean
          record_id?: string | null
          reviewer_department_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_evidence_document_id_fkey"
            columns: ["evidence_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_evidence_record_id_fkey"
            columns: ["evidence_record_id"]
            isOneToOne: false
            referencedRelation: "operational_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "operational_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_reviewer_department_id_fkey"
            columns: ["reviewer_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_shares: {
        Row: {
          approved_by: string
          created_at: string
          expires_at: string | null
          id: string
          organization_id: string
          recipient_label: string
          record_id: string
          revoked_at: string | null
          scope: string
        }
        Insert: {
          approved_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          organization_id: string
          recipient_label: string
          record_id: string
          revoked_at?: string | null
          scope: string
        }
        Update: {
          approved_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          organization_id?: string
          recipient_label?: string
          record_id?: string
          revoked_at?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_shares_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "operational_records"
            referencedColumns: ["id"]
          },
        ]
      }
      controlled_document_files: {
        Row: {
          audit_note: string
          checksum: string
          content_type: string
          department_id: string
          document_id: string
          id: string
          organization_id: string
          original_name: string
          revision: string
          size_bytes: number
          storage_path: string
          superseded_at: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          audit_note?: string
          checksum: string
          content_type: string
          department_id: string
          document_id: string
          id?: string
          organization_id: string
          original_name: string
          revision: string
          size_bytes: number
          storage_path: string
          superseded_at?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          audit_note?: string
          checksum?: string
          content_type?: string
          department_id?: string
          document_id?: string
          id?: string
          organization_id?: string
          original_name?: string
          revision?: string
          size_bytes?: number
          storage_path?: string
          superseded_at?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "controlled_document_files_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_document_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_document_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      department_role_assignments: {
        Row: {
          active: boolean
          assigned_by: string
          created_at: string
          id: string
          member_id: string
          role_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_by: string
          created_at?: string
          id?: string
          member_id: string
          role_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_by?: string
          created_at?: string
          id?: string
          member_id?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_role_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "department_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      department_roles: {
        Row: {
          active: boolean
          created_at: string
          department_id: string | null
          id: string
          name: string
          organization_id: string
          role_key: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          department_id?: string | null
          id?: string
          name: string
          organization_id: string
          role_key: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          department_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          role_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      department_settings: {
        Row: {
          active: boolean
          created_at: string
          department_id: string
          id: string
          setting_group: string
          setting_key: string
          updated_at: string
          value: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          department_id: string
          id?: string
          setting_group: string
          setting_key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          department_id?: string
          id?: string
          setting_group?: string
          setting_key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "department_settings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean
          code: string
          created_at: string
          department_type: string
          id: string
          lead_member_id: string | null
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          department_type: string
          id?: string
          lead_member_id?: string | null
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          department_type?: string
          id?: string
          lead_member_id?: string | null
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_lead_member_id_fkey"
            columns: ["lead_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          metadata: Json
          created_at: string
          created_by: string
          department_id: string | null
          document_type: string
          id: string
          organization_id: string
          record_id: string | null
          reference_url: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          metadata?: Json
          created_at?: string
          created_by: string
          department_id?: string | null
          document_type: string
          id?: string
          organization_id: string
          record_id?: string | null
          reference_url: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          metadata?: Json
          created_at?: string
          created_by?: string
          department_id?: string | null
          document_type?: string
          id?: string
          organization_id?: string
          record_id?: string | null
          reference_url?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "operational_records"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_records: {
        Row: {
          archived_at: string | null
          area: string
          created_at: string
          created_by: string
          department_id: string | null
          due_at: string | null
          fields: Json
          id: string
          is_demo: boolean
          notes: string
          organization_id: string
          priority: string
          record_type: string
          reference: string
          stage: string | null
          status: Database["public"]["Enums"]["portal_record_status"]
          title: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          archived_at?: string | null
          area: string
          created_at?: string
          created_by: string
          department_id?: string | null
          due_at?: string | null
          fields?: Json
          id?: string
          is_demo?: boolean
          notes?: string
          organization_id: string
          priority?: string
          record_type: string
          reference: string
          stage?: string | null
          status?: Database["public"]["Enums"]["portal_record_status"]
          title: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          archived_at?: string | null
          area?: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          due_at?: string | null
          fields?: Json
          id?: string
          is_demo?: boolean
          notes?: string
          organization_id?: string
          priority?: string
          record_type?: string
          reference?: string
          stage?: string | null
          status?: Database["public"]["Enums"]["portal_record_status"]
          title?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_records_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          main_location: string
          name: string
          numbering_format: string
          timezone: string
          updated_at: string
          working_days: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          main_location: string
          name: string
          numbering_format?: string
          timezone?: string
          updated_at?: string
          working_days?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          main_location?: string
          name?: string
          numbering_format?: string
          timezone?: string
          updated_at?: string
          working_days?: string
        }
        Relationships: []
      }
      record_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          organization_id: string
          relationship: string
          source_record_id: string
          target_record_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          relationship: string
          source_record_id: string
          target_record_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          relationship?: string
          source_record_id?: string
          target_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_links_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "operational_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_links_target_record_id_fkey"
            columns: ["target_record_id"]
            isOneToOne: false
            referencedRelation: "operational_records"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          permission_key: string
          role_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key: string
          role_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "department_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          blocker: string | null
          created_at: string
          created_by: string
          department_id: string | null
          due_at: string | null
          id: string
          organization_id: string
          priority: string
          record_id: string | null
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          blocker?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          due_at?: string | null
          id?: string
          organization_id: string
          priority?: string
          record_id?: string | null
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          blocker?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          due_at?: string | null
          id?: string
          organization_id?: string
          priority?: string
          record_id?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "operational_records"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_controlled_file_access: {
        Args: { p_file_id: string }
        Returns: {
          checksum: string
          content_type: string
          department_id: string
          document_id: string
          file_id: string
          organization_id: string
          original_name: string
          revision: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }[]
      }
      get_shared_test_workspace: { Args: never; Returns: Json }
      has_department_permission: {
        Args: {
          _department_id: string
          _organization_id: string
          _permission_key: string
        }
        Returns: boolean
      }
      has_organization_role: {
        Args: {
          _organization_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      is_organization_member: {
        Args: { _organization_id: string }
        Returns: boolean
      }
      mutate_shared_test_workspace: {
        Args: { p_action: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      resolve_operational_membership: {
        Args: never
        Returns: {
          can_sign_stage_gates: boolean
          department_code: string
          department_id: string
          department_name: string
          display_name: string
          is_lead: boolean
          membership_id: string
          organization_id: string
          organization_name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      resolve_test_membership: {
        Args: never
        Returns: {
          department_code: string
          department_name: string
          display_name: string
          is_client: boolean
          membership_id: string
          organization_id: string
          organization_name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      verify_and_advance_stage_gate: {
        Args: {
          p_evidence_manifest?: Json
          p_record_id: string
          p_target_stage: string
        }
        Returns: Json
      }
      verify_approved_stage_deliverable: {
        Args: {
          p_allow_na?: boolean
          p_deliverables: Json
          p_na_rationales: Json
          p_organization_id: string
          p_pattern: string
          p_record_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "department_lead" | "member" | "viewer"
      approval_outcome: "pending" | "approved" | "rejected" | "returned"
      portal_record_status:
        | "draft"
        | "open"
        | "in_review"
        | "approved"
        | "released"
        | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "department_lead", "member", "viewer"],
      approval_outcome: ["pending", "approved", "rejected", "returned"],
      portal_record_status: [
        "draft",
        "open",
        "in_review",
        "approved",
        "released",
        "archived",
      ],
    },
  },
} as const
