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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          referral_percent: number
          sendpulse_chat_id: string | null
          sendpulse_embed_html: string | null
          site_name: string
          site_url: string | null
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user: string | null
          tawk_property_id: string | null
          tawk_widget_id: string | null
          tidio_public_key: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          referral_percent?: number
          sendpulse_chat_id?: string | null
          sendpulse_embed_html?: string | null
          site_name?: string
          site_url?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          tawk_property_id?: string | null
          tawk_widget_id?: string | null
          tidio_public_key?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          referral_percent?: number
          sendpulse_chat_id?: string | null
          sendpulse_embed_html?: string | null
          site_name?: string
          site_url?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          tawk_property_id?: string | null
          tawk_widget_id?: string | null
          tidio_public_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          payer_phone: string | null
          payment_method_id: string | null
          proof_url: string | null
          reference: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          payer_phone?: string | null
          payment_method_id?: string | null
          proof_url?: string | null
          reference?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          payer_phone?: string | null
          payment_method_id?: string | null
          proof_url?: string | null
          reference?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          recipient: string
          status: string
          subject: string | null
          template_key: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          recipient: string
          status: string
          subject?: string | null
          template_key?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          recipient?: string
          status?: string
          subject?: string | null
          template_key?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          enabled: boolean
          html_body: string
          key: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          html_body: string
          key: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          html_body?: string
          key?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          amount: number
          daily_roi_percent: number
          duration_days: number
          end_date: string
          id: string
          is_paused: boolean
          last_payout_at: string | null
          plan_id: string
          start_date: string
          status: Database["public"]["Enums"]["investment_status"]
          total_earned: number
          user_id: string
        }
        Insert: {
          amount: number
          daily_roi_percent: number
          duration_days: number
          end_date: string
          id?: string
          is_paused?: boolean
          last_payout_at?: string | null
          plan_id: string
          start_date?: string
          status?: Database["public"]["Enums"]["investment_status"]
          total_earned?: number
          user_id: string
        }
        Update: {
          amount?: number
          daily_roi_percent?: number
          duration_days?: number
          end_date?: string
          id?: string
          is_paused?: boolean
          last_payout_at?: string | null
          plan_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["investment_status"]
          total_earned?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          active: boolean
          created_at: string
          id: string
          instructions: string | null
          label: string
          type: Database["public"]["Enums"]["payment_method_type"]
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          active?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          label: string
          type: Database["public"]["Enums"]["payment_method_type"]
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          active?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          label?: string
          type?: Database["public"]["Enums"]["payment_method_type"]
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          amount_type: string
          created_at: string
          daily_roi_percent: number
          description: string | null
          duration_days: number
          fixed_amount: number
          fixed_daily_profit: number
          id: string
          max_amount: number
          min_amount: number
          name: string
          payout_frequency: string
          profit_type: string
        }
        Insert: {
          active?: boolean
          amount_type?: string
          created_at?: string
          daily_roi_percent: number
          description?: string | null
          duration_days: number
          fixed_amount?: number
          fixed_daily_profit?: number
          id?: string
          max_amount: number
          min_amount: number
          name: string
          payout_frequency?: string
          profit_type?: string
        }
        Update: {
          active?: boolean
          amount_type?: string
          created_at?: string
          daily_roi_percent?: number
          description?: string | null
          duration_days?: number
          fixed_amount?: number
          fixed_daily_profit?: number
          id?: string
          max_amount?: number
          min_amount?: number
          name?: string
          payout_frequency?: string
          profit_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance: number
          created_at: string
          full_name: string | null
          id: string
          is_suspended: boolean
          kyc_status: string
          phone: string | null
          referral_code: string | null
          referral_earnings: number
          referred_by: string | null
          total_earned: number
          total_invested: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          full_name?: string | null
          id: string
          is_suspended?: boolean
          kyc_status?: string
          phone?: string | null
          referral_code?: string | null
          referral_earnings?: number
          referred_by?: string | null
          total_earned?: number
          total_invested?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          full_name?: string | null
          id?: string
          is_suspended?: boolean
          kyc_status?: string
          phone?: string | null
          referral_code?: string | null
          referral_earnings?: number
          referred_by?: string | null
          total_earned?: number
          total_invested?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          ref_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          ref_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          ref_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          account_name: string
          account_number: string
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method_type"]
          reviewed_at: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method_type"]
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method_type"]
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_app_settings: {
        Row: {
          id: number | null
          referral_percent: number | null
          sendpulse_chat_id: string | null
          sendpulse_embed_html: string | null
          site_name: string | null
          site_url: string | null
          tawk_property_id: string | null
          tawk_widget_id: string | null
          tidio_public_key: string | null
        }
        Insert: {
          id?: number | null
          referral_percent?: number | null
          sendpulse_chat_id?: string | null
          sendpulse_embed_html?: string | null
          site_name?: string | null
          site_url?: string | null
          tawk_property_id?: string | null
          tawk_widget_id?: string | null
          tidio_public_key?: string | null
        }
        Update: {
          id?: number | null
          referral_percent?: number | null
          sendpulse_chat_id?: string | null
          sendpulse_embed_html?: string | null
          site_name?: string | null
          site_url?: string | null
          tawk_property_id?: string | null
          tawk_widget_id?: string | null
          tidio_public_key?: string | null
        }
        Relationships: []
      }
      public_settings: {
        Row: {
          id: number | null
          site_name: string | null
          site_url: string | null
          tidio_public_key: string | null
        }
        Insert: {
          id?: number | null
          site_name?: string | null
          site_url?: string | null
          tidio_public_key?: string | null
        }
        Update: {
          id?: number | null
          site_name?: string | null
          site_url?: string | null
          tidio_public_key?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_investment: {
        Args: { _amount: number; _plan_id: string }
        Returns: string
      }
      distribute_profits: { Args: never; Returns: undefined }
      get_app_settings_admin: {
        Args: never
        Returns: {
          id: number
          referral_percent: number
          sendpulse_chat_id: string | null
          sendpulse_embed_html: string | null
          site_name: string
          site_url: string | null
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user: string | null
          tawk_property_id: string | null
          tawk_widget_id: string | null
          tidio_public_key: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "app_settings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recent_activity: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          created_at: string
          first_name: string
          kind: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      deposit_status: "pending" | "approved" | "rejected"
      investment_status: "active" | "completed" | "cancelled"
      payment_method_type: "mobile_money" | "bank_transfer" | "crypto"
      transaction_type:
        | "deposit"
        | "investment"
        | "roi"
        | "withdrawal"
        | "adjustment"
        | "profit"
        | "referral"
        | "investment_return"
      withdrawal_status: "pending" | "approved" | "rejected" | "paid"
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
      app_role: ["admin", "user"],
      deposit_status: ["pending", "approved", "rejected"],
      investment_status: ["active", "completed", "cancelled"],
      payment_method_type: ["mobile_money", "bank_transfer", "crypto"],
      transaction_type: [
        "deposit",
        "investment",
        "roi",
        "withdrawal",
        "adjustment",
        "profit",
        "referral",
        "investment_return",
      ],
      withdrawal_status: ["pending", "approved", "rejected", "paid"],
    },
  },
} as const
