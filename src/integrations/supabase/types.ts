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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      cognitive_profiles: {
        Row: {
          age: number | null
          created_at: string
          hyper_fixation: string | null
          id: string
          traits: string[]
          updated_at: string
          user_id: string
          wizard_answers: Json
          wizard_completed: boolean
        }
        Insert: {
          age?: number | null
          created_at?: string
          hyper_fixation?: string | null
          id?: string
          traits?: string[]
          updated_at?: string
          user_id: string
          wizard_answers?: Json
          wizard_completed?: boolean
        }
        Update: {
          age?: number | null
          created_at?: string
          hyper_fixation?: string | null
          id?: string
          traits?: string[]
          updated_at?: string
          user_id?: string
          wizard_answers?: Json
          wizard_completed?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_notes: {
        Row: {
          category_id: string | null
          content: string | null
          created_at: string
          folder: string
          id: string
          is_favorite: boolean | null
          learning_mode: string | null
          saved_videos: Json
          source_type: string | null
          sticky_notes: Json
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          content?: string | null
          created_at?: string
          folder?: string
          id?: string
          is_favorite?: boolean | null
          learning_mode?: string | null
          saved_videos?: Json
          source_type?: string | null
          sticky_notes?: Json
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          content?: string | null
          created_at?: string
          folder?: string
          id?: string
          is_favorite?: boolean | null
          learning_mode?: string | null
          saved_videos?: Json
          source_type?: string | null
          sticky_notes?: Json
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_notes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_study_materials: {
        Row: {
          category_id: string | null
          content: Json
          created_at: string
          id: string
          is_favorite: boolean | null
          material_type: string
          note_id: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          content?: Json
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          material_type?: string
          note_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          content?: Json
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          material_type?: string
          note_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_study_materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_study_materials_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "saved_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_events: {
        Row: {
          created_at: string
          event_data: Json
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          action_plan_default: boolean
          bionic_reading: boolean
          checklists_default: boolean
          color_tags_default: boolean
          created_at: string
          default_dark_mode: boolean
          dopamine_rewards: boolean
          dyslexia_font: boolean
          energy_mode: string
          feynman_default: boolean
          flowchart_default: boolean
          font_size: number
          fun_fact_custom_topic: string | null
          fun_fact_mode: string
          gamma_beats_enabled: boolean
          gamma_volume: number
          id: string
          insights_enabled: boolean
          isochronic_enabled: boolean
          isochronic_hz: number
          isochronic_volume: number
          jargon_default: boolean
          letter_spacing: number
          line_spacing: number
          lofi_enabled: boolean
          lofi_playlist_url: string | null
          lofi_volume: number
          mindmap_default: boolean
          quiz_default: boolean
          recall_prompts_default: boolean
          reduce_motion: boolean
          research_data_shared: boolean
          retention_quiz_default: boolean
          safe_to_fail: boolean
          simplify_default: boolean
          tldr_default: boolean
          updated_at: string
          user_id: string
          why_care_default: boolean
          word_spacing: number
        }
        Insert: {
          action_plan_default?: boolean
          bionic_reading?: boolean
          checklists_default?: boolean
          color_tags_default?: boolean
          created_at?: string
          default_dark_mode?: boolean
          dopamine_rewards?: boolean
          dyslexia_font?: boolean
          energy_mode?: string
          feynman_default?: boolean
          flowchart_default?: boolean
          font_size?: number
          fun_fact_custom_topic?: string | null
          fun_fact_mode?: string
          gamma_beats_enabled?: boolean
          gamma_volume?: number
          id?: string
          insights_enabled?: boolean
          isochronic_enabled?: boolean
          isochronic_hz?: number
          isochronic_volume?: number
          jargon_default?: boolean
          letter_spacing?: number
          line_spacing?: number
          lofi_enabled?: boolean
          lofi_playlist_url?: string | null
          lofi_volume?: number
          mindmap_default?: boolean
          quiz_default?: boolean
          recall_prompts_default?: boolean
          reduce_motion?: boolean
          research_data_shared?: boolean
          retention_quiz_default?: boolean
          safe_to_fail?: boolean
          simplify_default?: boolean
          tldr_default?: boolean
          updated_at?: string
          user_id: string
          why_care_default?: boolean
          word_spacing?: number
        }
        Update: {
          action_plan_default?: boolean
          bionic_reading?: boolean
          checklists_default?: boolean
          color_tags_default?: boolean
          created_at?: string
          default_dark_mode?: boolean
          dopamine_rewards?: boolean
          dyslexia_font?: boolean
          energy_mode?: string
          feynman_default?: boolean
          flowchart_default?: boolean
          font_size?: number
          fun_fact_custom_topic?: string | null
          fun_fact_mode?: string
          gamma_beats_enabled?: boolean
          gamma_volume?: number
          id?: string
          insights_enabled?: boolean
          isochronic_enabled?: boolean
          isochronic_hz?: number
          isochronic_volume?: number
          jargon_default?: boolean
          letter_spacing?: number
          line_spacing?: number
          lofi_enabled?: boolean
          lofi_playlist_url?: string | null
          lofi_volume?: number
          mindmap_default?: boolean
          quiz_default?: boolean
          recall_prompts_default?: boolean
          reduce_motion?: boolean
          research_data_shared?: boolean
          retention_quiz_default?: boolean
          safe_to_fail?: boolean
          simplify_default?: boolean
          tldr_default?: boolean
          updated_at?: string
          user_id?: string
          why_care_default?: boolean
          word_spacing?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
