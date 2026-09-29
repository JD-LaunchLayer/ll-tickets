export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type JobStatus =
  | "new"
  | "diagnosing"
  | "waiting_on_parts"
  | "waiting_on_customer"
  | "ready"
  | "collected"
  | "closed_no_repair";

type PriceBasis = "estimate" | "quote";

type BackupPosition = "customer_backed_up" | "we_backed_up" | "not_needed" | "not_discussed";

type NoteTag = "finding" | "work_done" | "parts" | "customer_contact" | "quote_auth" | "other";

export type Database = {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string;
          ref: string;
          customer_name: string;
          phone: string | null;
          device_label: string;
          reported_fault: string;
          status: JobStatus;
          next_move: string;
          price_gbp: number | null;
          price_basis: PriceBasis | null;
          price_agreed_at: string | null;
          backup_position: BackupPosition | null;
          access_given: boolean | null;
          collection_at: string | null;
          calendar_event_id: string | null;
          follow_up_at: string | null;
          created_at: string;
          updated_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          ref?: string;
          customer_name: string;
          phone?: string | null;
          device_label: string;
          reported_fault: string;
          status?: JobStatus;
          next_move: string;
          price_gbp?: number | null;
          price_basis?: PriceBasis | null;
          price_agreed_at?: string | null;
          backup_position?: BackupPosition | null;
          access_given?: boolean | null;
          collection_at?: string | null;
          calendar_event_id?: string | null;
          follow_up_at?: string | null;
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          ref?: string;
          customer_name?: string;
          phone?: string | null;
          device_label?: string;
          reported_fault?: string;
          status?: JobStatus;
          next_move?: string;
          price_gbp?: number | null;
          price_basis?: PriceBasis | null;
          price_agreed_at?: string | null;
          backup_position?: BackupPosition | null;
          access_given?: boolean | null;
          collection_at?: string | null;
          calendar_event_id?: string | null;
          follow_up_at?: string | null;
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          job_id: string;
          text: string;
          summary: string;
          tag: NoteTag | null;
          amount_gbp: number | null;
          part_detail: string | null;
          created_at: string;
          edited_at: string | null;
          client_request_id: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          text: string;
          summary: string;
          tag?: NoteTag | null;
          amount_gbp?: number | null;
          part_detail?: string | null;
          created_at?: string;
          edited_at?: string | null;
          client_request_id: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          text?: string;
          summary?: string;
          tag?: NoteTag | null;
          amount_gbp?: number | null;
          part_detail?: string | null;
          created_at?: string;
          edited_at?: string | null;
          client_request_id?: string;
        };
        Relationships: [];
      };
      note_revisions: {
        Row: {
          id: string;
          note_id: string;
          text: string;
          summary: string;
          tag: NoteTag | null;
          amount_gbp: number | null;
          part_detail: string | null;
          superseded_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          text: string;
          summary: string;
          tag?: NoteTag | null;
          amount_gbp?: number | null;
          part_detail?: string | null;
          superseded_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          text?: string;
          summary?: string;
          tag?: NoteTag | null;
          amount_gbp?: number | null;
          part_detail?: string | null;
          superseded_at?: string;
        };
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          job_id: string;
          note_id: string | null;
          storage_path: string;
          taken_at: string;
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          note_id?: string | null;
          storage_path: string;
          taken_at: string;
          caption?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          note_id?: string | null;
          storage_path?: string;
          taken_at?: string;
          caption?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      action_idempotency: {
        Row: {
          client_request_id: string;
          operation: string;
          request_hash: string;
          response: Json | null;
          http_status: number;
          created_at: string;
        };
        Insert: {
          client_request_id: string;
          operation: string;
          request_hash: string;
          response?: Json | null;
          http_status?: number;
          created_at?: string;
        };
        Update: {
          client_request_id?: string;
          operation?: string;
          request_hash?: string;
          response?: Json | null;
          http_status?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      assistant_daily_usage: {
        Row: {
          usage_date: string;
          message_count: number;
        };
        Insert: {
          usage_date: string;
          message_count?: number;
        };
        Update: {
          usage_date?: string;
          message_count?: number;
        };
        Relationships: [];
      };
      action_audit: {
        Row: {
          id: string;
          operation: string;
          client_request_id: string;
          job_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          operation: string;
          client_request_id: string;
          job_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          operation?: string;
          client_request_id?: string;
          job_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      list_expired_job_photos: {
        Args: Record<string, never>;
        Returns: { id: string; storage_path: string }[];
      };
      purge_expired_job_photos: {
        Args: Record<string, never>;
        Returns: number;
      };
      consume_assistant_message: {
        Args: { p_day: string; p_limit: number };
        Returns: boolean;
      };
    };
    Enums: {
      job_status: JobStatus;
      price_basis: PriceBasis;
      backup_position: BackupPosition;
      note_tag: NoteTag;
    };
    CompositeTypes: Record<string, never>;
  };
};
