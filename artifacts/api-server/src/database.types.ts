export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      appointment: {
        Row: {
          aesthetic: string;
          cal_booking_uid: string | null;
          category_id: number;
          created_at: string;
          customer_id: number | null;
          customer_notes: string | null;
          end_time: string;
          final_invoice_amount: number | null;
          id: number;
          internal_notes: string | null;
          photo_delivery_url: string | null;
          start_time: string;
          status_id: number | null;
          stripe_deposit_invoice_id: string | null;
          stripe_final_invoice_id: string | null;
        };
        Insert: {
          aesthetic: string;
          cal_booking_uid?: string | null;
          category_id?: number;
          created_at?: string;
          customer_id?: number | null;
          customer_notes?: string | null;
          end_time: string;
          final_invoice_amount?: number | null;
          id?: number;
          internal_notes?: string | null;
          photo_delivery_url?: string | null;
          start_time: string;
          status_id?: number | null;
          stripe_deposit_invoice_id?: string | null;
          stripe_final_invoice_id?: string | null;
        };
        Update: {
          aesthetic?: string;
          cal_booking_uid?: string | null;
          category_id?: number;
          created_at?: string;
          customer_id?: number | null;
          customer_notes?: string | null;
          end_time?: string;
          final_invoice_amount?: number | null;
          id?: number;
          internal_notes?: string | null;
          photo_delivery_url?: string | null;
          start_time?: string;
          status_id?: number | null;
          stripe_deposit_invoice_id?: string | null;
          stripe_final_invoice_id?: string | null;
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
          }
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
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Customer = Database["public"]["Tables"]["customer"]["Insert"];
export type Appointment = Database["public"]["Tables"]["appointment"]["Insert"];
export type Category = Database["public"]["Tables"]["category"]["Insert"];
