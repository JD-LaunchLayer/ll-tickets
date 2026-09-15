export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          id: string;
          customer_id: string;
          label: string;
          serial: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          label: string;
          serial?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          label?: string;
          serial?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "devices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          id: string;
          customer_id: string;
          device_id: string;
          symptom: string;
          status: Database["public"]["Enums"]["ticket_status"];
          waiting: boolean;
          arrival_kind: Database["public"]["Enums"]["arrival_kind"];
          due_at: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          device_id: string;
          symptom: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          waiting?: boolean;
          arrival_kind?: Database["public"]["Enums"]["arrival_kind"];
          due_at: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          device_id?: string;
          symptom?: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          waiting?: boolean;
          arrival_kind?: Database["public"]["Enums"]["arrival_kind"];
          due_at?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_notes: {
        Row: {
          id: string;
          ticket_id: string;
          kind: Database["public"]["Enums"]["note_kind"];
          body: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          kind?: Database["public"]["Enums"]["note_kind"];
          body: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          kind?: Database["public"]["Enums"]["note_kind"];
          body?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_notes_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      ticket_status: "intake" | "diagnose" | "parts" | "done";
      arrival_kind: "walk_in" | "appointment";
      note_kind: "note" | "finding" | "check_outcome" | "status";
    };
    CompositeTypes: Record<string, never>;
  };
};
