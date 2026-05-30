export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      appointment: {
        Row: {
          aesthetic: string;
          category_id: number;
          created_at: string;
          customer_id: number | null;
          customer_notes: string | null;
          end_time: string;
          id: number;
          internal_notes: string | null;
          start_time: string;
          status_id: number | null;
        };
        Insert: {
          aesthetic: string;
          category_id?: number;
          created_at?: string;
          customer_id?: number | null;
          customer_notes?: string | null;
          end_time: string;
          id?: number;
          internal_notes?: string | null;
          start_time: string;
          status_id?: number | null;
        };
        Update: {
          aesthetic?: string;
          category_id?: number;
          created_at?: string;
          customer_id?: number | null;
          customer_notes?: string | null;
          end_time?: string;
          id?: number;
          internal_notes?: string | null;
          start_time?: string;
          status_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "Appointment_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "category";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Appointment_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Appointment_status_id_fkey";
            columns: ["status_id"];
            isOneToOne: false;
            referencedRelation: "appointment_status";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_status: {
        Row: {
          id: number;
          status_desc: string | null;
          status_name: string;
        };
        Insert: {
          id?: number;
          status_desc?: string | null;
          status_name: string;
        };
        Update: {
          id?: number;
          status_desc?: string | null;
          status_name?: string;
        };
        Relationships: [];
      };
      category: {
        Row: {
          category_desc: string | null;
          category_name: string;
          id: number;
        };
        Insert: {
          category_desc?: string | null;
          category_name: string;
          id?: number;
        };
        Update: {
          category_desc?: string | null;
          category_name?: string;
          id?: number;
        };
        Relationships: [];
      };
      customer: {
        Row: {
          email_address: string;
          first_name: string;
          id: number;
          last_name: string;
          phone_number: string;
          preferred_contact_method: string;
        };
        Insert: {
          email_address: string;
          first_name: string;
          id?: number;
          last_name: string;
          phone_number: string;
          preferred_contact_method?: string;
        };
        Update: {
          email_address?: string;
          first_name?: string;
          id?: number;
          last_name?: string;
          phone_number?: string;
          preferred_contact_method?: string;
        };
        Relationships: [];
      };
      photo: {
        Row: {
          appointment_id: number | null;
          category_id: number;
          created_at: string;
          display_order_homepage: number | null;
          display_order_portfolio: number | null;
          featured_homepage: boolean;
          featured_portfolio: boolean;
          id: number;
          title: string | null;
          url: string;
        };
        Insert: {
          appointment_id?: number | null;
          category_id?: number;
          created_at?: string;
          display_order_homepage?: number | null;
          display_order_portfolio?: number | null;
          featured_homepage?: boolean;
          featured_portfolio?: boolean;
          id?: number;
          title?: string | null;
          url: string;
        };
        Update: {
          appointment_id?: number | null;
          category_id?: number;
          created_at?: string;
          display_order_homepage?: number | null;
          display_order_portfolio?: number | null;
          featured_homepage?: boolean;
          featured_portfolio?: boolean;
          id?: number;
          title?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "Photo_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Photo_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "category";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema =
  DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof (
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Tables"
      ]
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Views"
      ]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? (
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Views"
    ]
  )[TableName] extends {
    Row: infer R;
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (
    & DefaultSchema["Tables"]
    & DefaultSchema["Views"]
  ) ? (
      & DefaultSchema["Tables"]
      & DefaultSchema["Views"]
    )[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    } ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Insert: infer I;
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Update: infer U;
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]][
      "Enums"
    ]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][
    EnumName
  ]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]][
    "CompositeTypes"
  ][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

export type Customer = Database["public"]["Tables"]["customer"]["Insert"];
export type Appointment = Database["public"]["Tables"]["appointment"]["Insert"];
export type Category = Database["public"]["Tables"]["category"]["Insert"];
