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
      ancient_texts: {
        Row: {
          abbreviations: string[] | null
          canonical_name: string
          category: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          merged_into_id: string | null
          updated_at: string
        }
        Insert: {
          abbreviations?: string[] | null
          canonical_name: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          merged_into_id?: string | null
          updated_at?: string
        }
        Update: {
          abbreviations?: string[] | null
          canonical_name?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          merged_into_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ancient_texts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ancient_texts_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "ancient_texts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string
          revertible: boolean
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id: string
          revertible?: boolean
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string
          revertible?: boolean
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bible_books: {
        Row: {
          id: string
          name: string
          sort_order: number
          testament: string
        }
        Insert: {
          id?: string
          name: string
          sort_order: number
          testament: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          testament?: string
        }
        Relationships: []
      }
      book_ancient_coverage: {
        Row: {
          ancient_text_id: string
          book_id: string | null
          created_at: string
          created_by: string | null
          essay_id: string | null
          id: string
        }
        Insert: {
          ancient_text_id: string
          book_id?: string | null
          created_at?: string
          created_by?: string | null
          essay_id?: string | null
          id?: string
        }
        Update: {
          ancient_text_id?: string
          book_id?: string | null
          created_at?: string
          created_by?: string | null
          essay_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_ancient_coverage_ancient_text_id_fkey"
            columns: ["ancient_text_id"]
            isOneToOne: false
            referencedRelation: "ancient_texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_ancient_coverage_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_ancient_coverage_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_ancient_coverage_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      book_authors: {
        Row: {
          book_id: string
          person_id: string
          role: string
          sort_order: number
        }
        Insert: {
          book_id: string
          person_id: string
          role: string
          sort_order?: number
        }
        Update: {
          book_id?: string
          person_id?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "book_authors_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_authors_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      book_bible_coverage: {
        Row: {
          bible_book: string
          book_id: string | null
          created_at: string
          created_by: string | null
          essay_id: string | null
          id: string
        }
        Insert: {
          bible_book: string
          book_id?: string | null
          created_at?: string
          created_by?: string | null
          essay_id?: string | null
          id?: string
        }
        Update: {
          bible_book?: string
          book_id?: string | null
          created_at?: string
          created_by?: string | null
          essay_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_bible_coverage_bible_book_fkey"
            columns: ["bible_book"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "book_bible_coverage_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_bible_coverage_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_bible_coverage_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      book_metadata_proposals: {
        Row: {
          book_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          fields: Json
          id: string
          reviewed_at: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          book_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fields?: Json
          id?: string
          reviewed_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fields?: Json
          id?: string
          reviewed_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_metadata_proposals_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_metadata_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_topics: {
        Row: {
          book_id: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          essay_id: string | null
          id: string
          needs_review: boolean
          page_end: string | null
          page_start: string
          review_note: string | null
          source_image_url: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          book_id?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          essay_id?: string | null
          id?: string
          needs_review?: boolean
          page_end?: string | null
          page_start: string
          review_note?: string | null
          source_image_url?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          book_id?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          essay_id?: string | null
          id?: string
          needs_review?: boolean
          page_end?: string | null
          page_start?: string
          review_note?: string | null
          source_image_url?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_topics_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_topics_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author_display: string | null
          barcode: string | null
          borrowed_to: string | null
          copy_count: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          edition: string | null
          genre: string | null
          id: string
          import_match_type: string | null
          isbn: string | null
          language: string
          needs_review: boolean
          needs_review_note: string | null
          no_attributed_author: boolean
          original_year: number | null
          owned: boolean
          page_count: number | null
          personal_notes: string | null
          publisher: string | null
          publisher_canonical_display: string | null
          publisher_id: string | null
          publisher_location: string | null
          publisher_location_display: string | null
          rating: number | null
          reading_status: string
          reprint_location: string | null
          reprint_publisher: string | null
          reprint_publisher_id: string | null
          reprint_year: number | null
          search_vector: unknown
          series_id: string | null
          shelving_location: string | null
          subtitle: string | null
          title: string | null
          total_volumes: number | null
          updated_at: string
          volume_number: string | null
          work_type: string
          year: number | null
        }
        Insert: {
          author_display?: string | null
          barcode?: string | null
          borrowed_to?: string | null
          copy_count?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          edition?: string | null
          genre?: string | null
          id?: string
          import_match_type?: string | null
          isbn?: string | null
          language?: string
          needs_review?: boolean
          needs_review_note?: string | null
          no_attributed_author?: boolean
          original_year?: number | null
          owned?: boolean
          page_count?: number | null
          personal_notes?: string | null
          publisher?: string | null
          publisher_canonical_display?: string | null
          publisher_id?: string | null
          publisher_location?: string | null
          publisher_location_display?: string | null
          rating?: number | null
          reading_status?: string
          reprint_location?: string | null
          reprint_publisher?: string | null
          reprint_publisher_id?: string | null
          reprint_year?: number | null
          search_vector?: unknown
          series_id?: string | null
          shelving_location?: string | null
          subtitle?: string | null
          title?: string | null
          total_volumes?: number | null
          updated_at?: string
          volume_number?: string | null
          work_type?: string
          year?: number | null
        }
        Update: {
          author_display?: string | null
          barcode?: string | null
          borrowed_to?: string | null
          copy_count?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          edition?: string | null
          genre?: string | null
          id?: string
          import_match_type?: string | null
          isbn?: string | null
          language?: string
          needs_review?: boolean
          needs_review_note?: string | null
          no_attributed_author?: boolean
          original_year?: number | null
          owned?: boolean
          page_count?: number | null
          personal_notes?: string | null
          publisher?: string | null
          publisher_canonical_display?: string | null
          publisher_id?: string | null
          publisher_location?: string | null
          publisher_location_display?: string | null
          rating?: number | null
          reading_status?: string
          reprint_location?: string | null
          reprint_publisher?: string | null
          reprint_publisher_id?: string | null
          reprint_year?: number | null
          search_vector?: unknown
          series_id?: string | null
          shelving_location?: string | null
          subtitle?: string | null
          title?: string | null
          total_volumes?: number | null
          updated_at?: string
          volume_number?: string | null
          work_type?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "books_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_reprint_publisher_id_fkey"
            columns: ["reprint_publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      client_rates: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          effective_to: string | null
          id: string
          rate: number
          service_type: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          rate: number
          service_type?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          rate?: number
          service_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_rates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          billing_cadence: string
          billing_contact: string | null
          consultation_grouping: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string[]
          id: string
          name: string
          sort_rank: number | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          billing_cadence?: string
          billing_contact?: string | null
          consultation_grouping?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string[]
          id?: string
          name: string
          sort_rank?: number | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          billing_cadence?: string
          billing_contact?: string | null
          consultation_grouping?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string[]
          id?: string
          name?: string
          sort_rank?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_authors: {
        Row: {
          essay_id: string
          person_id: string
          role: string
          sort_order: number
        }
        Insert: {
          essay_id: string
          person_id: string
          role: string
          sort_order?: number
        }
        Update: {
          essay_id?: string
          person_id?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "essay_authors_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_authors_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      essays: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          essay_title: string
          id: string
          page_end: number | null
          page_start: number | null
          parent_book_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          essay_title: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          parent_book_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          essay_title?: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          parent_book_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "essays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_parent_book_id_fkey"
            columns: ["parent_book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          end_date: string | null
          id: string
          invoice_id: string
          is_one_off: boolean
          quantity: number | null
          sort_order: number
          start_date: string | null
          total: number
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          end_date?: string | null
          id?: string
          invoice_id: string
          is_one_off?: boolean
          quantity?: number | null
          sort_order?: number
          start_date?: string | null
          total: number
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          end_date?: string | null
          id?: string
          invoice_id?: string
          is_one_off?: boolean
          quantity?: number | null
          sort_order?: number
          start_date?: string | null
          total?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          sent_at: string | null
          status: string
          subtotal: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          sent_at?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          sent_at?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_ocr_usage: {
        Row: {
          call_count: number
          usage_date: string
          user_id: string
        }
        Insert: {
          call_count?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          call_count?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      module_registry: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      people: {
        Row: {
          aliases: string[]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          first_name: string | null
          id: string
          last_name: string
          merged_into_id: string | null
          middle_name: string | null
          suffix: string | null
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          first_name?: string | null
          id?: string
          last_name: string
          merged_into_id?: string | null
          middle_name?: string | null
          suffix?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string
          merged_into_id?: string | null
          middle_name?: string | null
          suffix?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_cc_emails: string[]
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_cc_emails?: string[]
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_cc_emails?: string[]
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          project_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          project_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          project_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_series: {
        Row: {
          bymonthday: number | null
          byweekday: number[] | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          ends: string
          ends_count: number | null
          ends_on: string | null
          freq: string
          id: string
          interval: number
          notes: string | null
          occurrence_seq: number
          priority: string
          project_id: string
          stopped_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bymonthday?: number | null
          byweekday?: number[] | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends?: string
          ends_count?: number | null
          ends_on?: string | null
          freq: string
          id?: string
          interval?: number
          notes?: string | null
          occurrence_seq?: number
          priority?: string
          project_id: string
          stopped_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bymonthday?: number | null
          byweekday?: number[] | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends?: string
          ends_count?: number | null
          ends_on?: string | null
          freq?: string
          id?: string
          interval?: number
          notes?: string | null
          occurrence_seq?: number
          priority?: string
          project_id?: string
          stopped_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_series_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          priority: string
          project_id: string
          series_id: string | null
          series_occurrence: number | null
          sort_order: number
          source_email_id: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          project_id: string
          series_id?: string | null
          series_occurrence?: number | null
          sort_order?: number
          source_email_id?: string | null
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          project_id?: string
          series_id?: string | null
          series_occurrence?: number | null
          sort_order?: number
          source_email_id?: string | null
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "project_task_series"
            referencedColumns: ["id"]
          },
        ]
      }
      project_updates: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          health_status: string
          id: string
          next_steps: string | null
          progress_max: number | null
          progress_note: string | null
          progress_value: number | null
          project_id: string
          reason: string | null
          updated_at: string
          week_of: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          health_status: string
          id?: string
          next_steps?: string | null
          progress_max?: number | null
          progress_note?: string | null
          progress_value?: number | null
          project_id: string
          reason?: string | null
          updated_at?: string
          week_of: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          health_status?: string
          id?: string
          next_steps?: string | null
          progress_max?: number | null
          progress_note?: string | null
          progress_value?: number | null
          project_id?: string
          reason?: string | null
          updated_at?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string
          lifecycle_status: string
          name: string
          parent_id: string | null
          sort_order: number
          start_date: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          lifecycle_status?: string
          name: string
          parent_id?: string | null
          sort_order?: number
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          lifecycle_status?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      publishers: {
        Row: {
          aliases: string[]
          canonical_name: string
          created_at: string
          created_by: string | null
          default_location: string | null
          deleted_at: string | null
          id: string
          merged_into_id: string | null
          notes: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          canonical_name: string
          created_at?: string
          created_by?: string | null
          default_location?: string | null
          deleted_at?: string | null
          id?: string
          merged_into_id?: string | null
          notes?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          canonical_name?: string
          created_at?: string
          created_by?: string | null
          default_location?: string | null
          deleted_at?: string | null
          id?: string
          merged_into_id?: string | null
          notes?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publishers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publishers_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publishers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      scripture_references: {
        Row: {
          bible_book: string
          book_id: string | null
          chapter_end: number | null
          chapter_start: number | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          essay_id: string | null
          id: string
          needs_review: boolean
          page_end: string | null
          page_start: string
          review_note: string | null
          source_image_url: string | null
          updated_at: string
          verse_end: number | null
          verse_end_abs: number | null
          verse_start: number | null
          verse_start_abs: number | null
        }
        Insert: {
          bible_book: string
          book_id?: string | null
          chapter_end?: number | null
          chapter_start?: number | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          essay_id?: string | null
          id?: string
          needs_review?: boolean
          page_end?: string | null
          page_start: string
          review_note?: string | null
          source_image_url?: string | null
          updated_at?: string
          verse_end?: number | null
          verse_end_abs?: number | null
          verse_start?: number | null
          verse_start_abs?: number | null
        }
        Update: {
          bible_book?: string
          book_id?: string | null
          chapter_end?: number | null
          chapter_start?: number | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          essay_id?: string | null
          id?: string
          needs_review?: boolean
          page_end?: string | null
          page_start?: string
          review_note?: string | null
          source_image_url?: string | null
          updated_at?: string
          verse_end?: number | null
          verse_end_abs?: number | null
          verse_start?: number | null
          verse_start_abs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scripture_references_bible_book_fkey"
            columns: ["bible_book"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "scripture_references_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripture_references_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripture_references_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          abbreviation: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          abbreviation?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          abbreviation?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sermon_passages: {
        Row: {
          bible_book: string
          chapter_end: number | null
          chapter_start: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          sermon_id: string
          sort_order: number
          updated_at: string
          verse_end: number | null
          verse_start: number | null
        }
        Insert: {
          bible_book: string
          chapter_end?: number | null
          chapter_start?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          sermon_id: string
          sort_order?: number
          updated_at?: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Update: {
          bible_book?: string
          chapter_end?: number | null
          chapter_start?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          sermon_id?: string
          sort_order?: number
          updated_at?: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sermon_passages_bible_book_fkey"
            columns: ["bible_book"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "sermon_passages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sermon_passages_sermon_id_fkey"
            columns: ["sermon_id"]
            isOneToOne: false
            referencedRelation: "sermons"
            referencedColumns: ["id"]
          },
        ]
      }
      sermon_venues: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sermon_venues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sermons: {
        Row: {
          context_type: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          passage_display: string | null
          preached_on: string
          topic: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          context_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          passage_display?: string | null
          preached_on: string
          topic?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          context_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          passage_display?: string | null
          preached_on?: string
          topic?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sermons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sermons_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "sermon_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean
          client_id: string
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          description: string | null
          hours: number
          id: string
          invoice_id: string | null
          is_one_off: boolean
          rate: number
          updated_at: string
        }
        Insert: {
          billable?: boolean
          client_id: string
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          description?: string | null
          hours: number
          id?: string
          invoice_id?: string | null
          is_one_off?: boolean
          rate: number
          updated_at?: string
        }
        Update: {
          billable?: boolean
          client_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          description?: string | null
          hours?: number
          id?: string
          invoice_id?: string | null
          is_one_off?: boolean
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          access_level: string
          created_at: string
          id: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level: string
          created_at?: string
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_has_module_read: { Args: { p_module: string }; Returns: boolean }
      app_is_owner: { Args: never; Returns: boolean }
      app_is_viewer_writer: { Args: { p_module: string }; Returns: boolean }
      app_module_access_level: { Args: { p_module: string }; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      invoicing_unbilled_counts: {
        Args: never
        Returns: {
          client_id: string
          client_name: string
          entry_count: number
        }[]
      }
      library_compute_author_display: {
        Args: { p_book_id: string }
        Returns: string
      }
      library_merge_ancient_texts: {
        Args: { p_canonical: string; p_merged_away: string }
        Returns: undefined
      }
      library_merge_people: {
        Args: { p_canonical: string; p_merged_away: string }
        Returns: undefined
      }
      library_merge_publishers: {
        Args: { p_canonical: string; p_merged_away: string }
        Returns: undefined
      }
      library_refresh_book_list_denorm: {
        Args: { p_book_id: string }
        Returns: undefined
      }
      normalize_publisher_text: { Args: { raw: string }; Returns: string }
      search_scripture_refs: {
        Args: { p_bible_book: string; p_chapter?: number; p_verse?: number }
        Returns: {
          bible_book: string
          book_id: string
          book_subtitle: string
          book_title: string
          chapter_end: number
          chapter_start: number
          confidence_score: number
          essay_id: string
          manual_entry: boolean
          needs_review: boolean
          page_end: string
          page_start: string
          ref_id: string
          review_note: string
          verse_end: number
          verse_start: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
