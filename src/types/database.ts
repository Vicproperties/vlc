export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          actor_type: string;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: number;
          ip_hash: string | null;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          actor_type: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
          ip_hash?: string | null;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          actor_type?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
          ip_hash?: string | null;
          metadata?: Json;
        };
        Relationships: [];
      };
      admin_permissions: {
        Row: {
          admin_id: string;
          can_create: boolean;
          can_delete: boolean;
          can_edit: boolean;
          can_publish: boolean;
          can_view: boolean;
          module: Database["public"]["Enums"]["admin_module"];
          updated_at: string;
        };
        Insert: {
          admin_id: string;
          can_create?: boolean;
          can_delete?: boolean;
          can_edit?: boolean;
          can_publish?: boolean;
          can_view?: boolean;
          module: Database["public"]["Enums"]["admin_module"];
          updated_at?: string;
        };
        Update: {
          admin_id?: string;
          can_create?: boolean;
          can_delete?: boolean;
          can_edit?: boolean;
          can_publish?: boolean;
          can_view?: boolean;
          module?: Database["public"]["Enums"]["admin_module"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_permissions_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admin_users";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_users: {
        Row: {
          created_at: string;
          created_by: string | null;
          deactivated_at: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          last_login_at: string | null;
          role: Database["public"]["Enums"]["admin_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deactivated_at?: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          last_login_at?: string | null;
          role?: Database["public"]["Enums"]["admin_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deactivated_at?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          last_login_at?: string | null;
          role?: Database["public"]["Enums"]["admin_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_users_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "admin_users";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics_daily: {
        Row: {
          day: string;
          dimension: string;
          metric: string;
          value: number;
        };
        Insert: {
          day: string;
          dimension?: string;
          metric: string;
          value?: number;
        };
        Update: {
          day?: string;
          dimension?: string;
          metric?: string;
          value?: number;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          created_at: string;
          id: number;
          path: string | null;
          property_id: string | null;
          session_id: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          path?: string | null;
          property_id?: string | null;
          session_id: string;
          type: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          path?: string | null;
          property_id?: string | null;
          session_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analytics_events_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analytics_events_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analytics_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "analytics_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics_sessions: {
        Row: {
          browser_family: string | null;
          city: string | null;
          country: string | null;
          current_path: string | null;
          current_property_id: string | null;
          device_type: string | null;
          id: string;
          landing_path: string | null;
          last_seen_at: string;
          referrer_host: string | null;
          region: string | null;
          source: string | null;
          started_at: string;
          utm_campaign: string | null;
          utm_medium: string | null;
          utm_source: string | null;
        };
        Insert: {
          browser_family?: string | null;
          city?: string | null;
          country?: string | null;
          current_path?: string | null;
          current_property_id?: string | null;
          device_type?: string | null;
          id: string;
          landing_path?: string | null;
          last_seen_at?: string;
          referrer_host?: string | null;
          region?: string | null;
          source?: string | null;
          started_at?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
        };
        Update: {
          browser_family?: string | null;
          city?: string | null;
          country?: string | null;
          current_path?: string | null;
          current_property_id?: string | null;
          device_type?: string | null;
          id?: string;
          landing_path?: string | null;
          last_seen_at?: string;
          referrer_host?: string | null;
          region?: string | null;
          source?: string | null;
          started_at?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "analytics_sessions_current_property_id_fkey";
            columns: ["current_property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analytics_sessions_current_property_id_fkey";
            columns: ["current_property_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          cta_label: string | null;
          cta_url: string | null;
          ends_at: string | null;
          frequency: Database["public"]["Enums"]["announcement_frequency"];
          frequency_days: number | null;
          heading: string;
          id: string;
          image_alt: string | null;
          image_path: string | null;
          is_active: boolean;
          message: string | null;
          priority: number;
          starts_at: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          cta_label?: string | null;
          cta_url?: string | null;
          ends_at?: string | null;
          frequency?: Database["public"]["Enums"]["announcement_frequency"];
          frequency_days?: number | null;
          heading: string;
          id?: string;
          image_alt?: string | null;
          image_path?: string | null;
          is_active?: boolean;
          message?: string | null;
          priority?: number;
          starts_at?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          cta_label?: string | null;
          cta_url?: string | null;
          ends_at?: string | null;
          frequency?: Database["public"]["Enums"]["announcement_frequency"];
          frequency_days?: number | null;
          heading?: string;
          id?: string;
          image_alt?: string | null;
          image_path?: string | null;
          is_active?: boolean;
          message?: string | null;
          priority?: number;
          starts_at?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      blog_authors: {
        Row: {
          admin_id: string | null;
          bio: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          photo_path: string | null;
          role_title: string | null;
          slug: string;
        };
        Insert: {
          admin_id?: string | null;
          bio?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          photo_path?: string | null;
          role_title?: string | null;
          slug: string;
        };
        Update: {
          admin_id?: string | null;
          bio?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          photo_path?: string | null;
          role_title?: string | null;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blog_authors_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admin_users";
            referencedColumns: ["id"];
          },
        ];
      };
      blog_categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      blog_posts: {
        Row: {
          author_id: string | null;
          category_id: string | null;
          content_html: string | null;
          content_json: Json;
          created_at: string;
          excerpt: string | null;
          featured_image_alt: string | null;
          featured_image_path: string | null;
          id: string;
          is_featured: boolean;
          published_at: string | null;
          search_vector: unknown;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: Database["public"]["Enums"]["post_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          category_id?: string | null;
          content_html?: string | null;
          content_json?: Json;
          created_at?: string;
          excerpt?: string | null;
          featured_image_alt?: string | null;
          featured_image_path?: string | null;
          id?: string;
          is_featured?: boolean;
          published_at?: string | null;
          search_vector?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["post_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          category_id?: string | null;
          content_html?: string | null;
          content_json?: Json;
          created_at?: string;
          excerpt?: string | null;
          featured_image_alt?: string | null;
          featured_image_path?: string | null;
          id?: string;
          is_featured?: boolean;
          published_at?: string | null;
          search_vector?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["post_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "blog_authors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blog_posts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "blog_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      building_types: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      contact_submissions: {
        Row: {
          archived_at: string | null;
          created_at: string;
          email: string;
          handled_by: string | null;
          id: string;
          is_read: boolean;
          message: string;
          name: string;
          phone: string | null;
          subject: string | null;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          email: string;
          handled_by?: string | null;
          id?: string;
          is_read?: boolean;
          message: string;
          name: string;
          phone?: string | null;
          subject?: string | null;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          email?: string;
          handled_by?: string | null;
          id?: string;
          is_read?: boolean;
          message?: string;
          name?: string;
          phone?: string | null;
          subject?: string | null;
        };
        Relationships: [];
      };
      cookie_consents: {
        Row: {
          analytics: boolean;
          anon_id: string;
          created_at: string;
          id: number;
          marketing: boolean;
          policy_version: string;
        };
        Insert: {
          analytics: boolean;
          anon_id: string;
          created_at?: string;
          id?: never;
          marketing: boolean;
          policy_version: string;
        };
        Update: {
          analytics?: boolean;
          anon_id?: string;
          created_at?: string;
          id?: never;
          marketing?: boolean;
          policy_version?: string;
        };
        Relationships: [];
      };
      cookie_settings: {
        Row: {
          analytics_description: string | null;
          enable_first_party_analytics: boolean;
          enable_google_analytics: boolean;
          id: number;
          marketing_description: string | null;
          notice_text: string | null;
          policy_version: string;
          updated_at: string;
        };
        Insert: {
          analytics_description?: string | null;
          enable_first_party_analytics?: boolean;
          enable_google_analytics?: boolean;
          id?: number;
          marketing_description?: string | null;
          notice_text?: string | null;
          policy_version?: string;
          updated_at?: string;
        };
        Update: {
          analytics_description?: string | null;
          enable_first_party_analytics?: boolean;
          enable_google_analytics?: boolean;
          id?: number;
          marketing_description?: string | null;
          notice_text?: string | null;
          policy_version?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      core_values: {
        Row: {
          description: string | null;
          icon_key: string | null;
          id: string;
          is_active: boolean;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          description?: string | null;
          icon_key?: string | null;
          id?: string;
          is_active?: boolean;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          description?: string | null;
          icon_key?: string | null;
          id?: string;
          is_active?: boolean;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      estates: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          location: string | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          location?: string | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          location?: string | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      faqs: {
        Row: {
          answer: string;
          id: string;
          is_active: boolean;
          question: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          answer: string;
          id?: string;
          is_active?: boolean;
          question: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          answer?: string;
          id?: string;
          is_active?: boolean;
          question?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      favourites: {
        Row: {
          created_at: string;
          customer_id: string;
          property_id: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          property_id: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          property_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favourites_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favourites_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      import_jobs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          duplicate_count: number;
          error_count: number;
          file_name: string | null;
          id: string;
          kind: Database["public"]["Enums"]["property_kind"];
          row_count: number;
          status: Database["public"]["Enums"]["import_status"];
          uploaded_by: string | null;
          valid_count: number;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          duplicate_count?: number;
          error_count?: number;
          file_name?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["property_kind"];
          row_count?: number;
          status?: Database["public"]["Enums"]["import_status"];
          uploaded_by?: string | null;
          valid_count?: number;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          duplicate_count?: number;
          error_count?: number;
          file_name?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["property_kind"];
          row_count?: number;
          status?: Database["public"]["Enums"]["import_status"];
          uploaded_by?: string | null;
          valid_count?: number;
        };
        Relationships: [];
      };
      import_rows: {
        Row: {
          duplicate_candidate_id: string | null;
          errors: Json;
          estate_match_id: string | null;
          id: number;
          job_id: string;
          normalized: Json | null;
          property_id: string | null;
          raw: Json;
          row_number: number;
        };
        Insert: {
          duplicate_candidate_id?: string | null;
          errors?: Json;
          estate_match_id?: string | null;
          id?: never;
          job_id: string;
          normalized?: Json | null;
          property_id?: string | null;
          raw: Json;
          row_number: number;
        };
        Update: {
          duplicate_candidate_id?: string | null;
          errors?: Json;
          estate_match_id?: string | null;
          id?: never;
          job_id?: string;
          normalized?: Json | null;
          property_id?: string | null;
          raw?: Json;
          row_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "import_rows_duplicate_candidate_id_fkey";
            columns: ["duplicate_candidate_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_rows_duplicate_candidate_id_fkey";
            columns: ["duplicate_candidate_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_rows_estate_match_id_fkey";
            columns: ["estate_match_id"];
            isOneToOne: false;
            referencedRelation: "estates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_rows_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_rows_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_rows_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_requests: {
        Row: {
          admin_notes: string | null;
          created_at: string;
          customer_id: string | null;
          email: string | null;
          full_name: string;
          handled_by: string | null;
          id: string;
          message: string | null;
          phone: string;
          preferred_date: string | null;
          preferred_time: string | null;
          property_id: string | null;
          property_snapshot: Json;
          status: Database["public"]["Enums"]["inspection_status"];
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          created_at?: string;
          customer_id?: string | null;
          email?: string | null;
          full_name: string;
          handled_by?: string | null;
          id?: string;
          message?: string | null;
          phone: string;
          preferred_date?: string | null;
          preferred_time?: string | null;
          property_id?: string | null;
          property_snapshot?: Json;
          status?: Database["public"]["Enums"]["inspection_status"];
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          created_at?: string;
          customer_id?: string | null;
          email?: string | null;
          full_name?: string;
          handled_by?: string | null;
          id?: string;
          message?: string | null;
          phone?: string;
          preferred_date?: string | null;
          preferred_time?: string | null;
          property_id?: string | null;
          property_snapshot?: Json;
          status?: Database["public"]["Enums"]["inspection_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_requests_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_requests_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["inspection_status"] | null;
          id: number;
          note: string | null;
          request_id: string;
          to_status: Database["public"]["Enums"]["inspection_status"];
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["inspection_status"] | null;
          id?: never;
          note?: string | null;
          request_id: string;
          to_status: Database["public"]["Enums"]["inspection_status"];
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["inspection_status"] | null;
          id?: never;
          note?: string | null;
          request_id?: string;
          to_status?: Database["public"]["Enums"]["inspection_status"];
        };
        Relationships: [
          {
            foreignKeyName: "inspection_status_history_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "inspection_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_status_history_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "my_inspection_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_pages: {
        Row: {
          content_html: string | null;
          content_json: Json;
          is_published: boolean;
          last_reviewed_at: string | null;
          needs_legal_review: boolean;
          slug: string;
          title: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          content_html?: string | null;
          content_json?: Json;
          is_published?: boolean;
          last_reviewed_at?: string | null;
          needs_legal_review?: boolean;
          slug: string;
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          content_html?: string | null;
          content_json?: Json;
          is_published?: boolean;
          last_reviewed_at?: string | null;
          needs_legal_review?: boolean;
          slug?: string;
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      media_assets: {
        Row: {
          alt_text: string | null;
          bucket: string;
          created_at: string;
          height: number | null;
          id: string;
          mime_type: string;
          path: string;
          size_bytes: number;
          uploaded_by: string | null;
          width: number | null;
        };
        Insert: {
          alt_text?: string | null;
          bucket: string;
          created_at?: string;
          height?: number | null;
          id?: string;
          mime_type: string;
          path: string;
          size_bytes: number;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          bucket?: string;
          created_at?: string;
          height?: number | null;
          id?: string;
          mime_type?: string;
          path?: string;
          size_bytes?: number;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          confirm_token_expires_at: string | null;
          confirm_token_hash: string | null;
          confirmed_at: string | null;
          consent_text_version: string | null;
          email: string;
          id: string;
          source: string | null;
          status: Database["public"]["Enums"]["newsletter_status"];
          subscribed_at: string;
          unsubscribe_token_hash: string | null;
          unsubscribed_at: string | null;
          updated_at: string;
        };
        Insert: {
          confirm_token_expires_at?: string | null;
          confirm_token_hash?: string | null;
          confirmed_at?: string | null;
          consent_text_version?: string | null;
          email: string;
          id?: string;
          source?: string | null;
          status?: Database["public"]["Enums"]["newsletter_status"];
          subscribed_at?: string;
          unsubscribe_token_hash?: string | null;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          confirm_token_expires_at?: string | null;
          confirm_token_hash?: string | null;
          confirmed_at?: string | null;
          consent_text_version?: string | null;
          email?: string;
          id?: string;
          source?: string | null;
          status?: Database["public"]["Enums"]["newsletter_status"];
          subscribed_at?: string;
          unsubscribe_token_hash?: string | null;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      page_sections: {
        Row: {
          content: Json;
          is_visible: boolean;
          page_key: string;
          section_key: string;
          updated_at: string;
        };
        Insert: {
          content?: Json;
          is_visible?: boolean;
          page_key: string;
          section_key: string;
          updated_at?: string;
        };
        Update: {
          content?: Json;
          is_visible?: boolean;
          page_key?: string;
          section_key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          address: string | null;
          available_plots: number | null;
          bathrooms: number | null;
          bedrooms: number | null;
          building_type_id: string | null;
          city: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          description_html: string | null;
          dimensions: string | null;
          discount_percent: number | null;
          duplicate_of: string | null;
          duplicate_reviewed_at: string | null;
          duplicate_reviewed_by: string | null;
          duplicate_state: Database["public"]["Enums"]["duplicate_state"];
          effective_price: number | null;
          estate_id: string | null;
          featured_order: number | null;
          features: string[];
          google_maps_url: string | null;
          id: string;
          instalment_note: string | null;
          instalment_price: number | null;
          is_featured: boolean;
          kind: Database["public"]["Enums"]["property_kind"];
          land_size: number | null;
          land_size_unit: Database["public"]["Enums"]["land_size_unit"] | null;
          land_use: Database["public"]["Enums"]["land_use"] | null;
          location_text: string | null;
          og_image_path: string | null;
          parking_spaces: number | null;
          price_period: Database["public"]["Enums"]["price_period"] | null;
          promotion_active: boolean;
          published_at: string | null;
          purpose: Database["public"]["Enums"]["transaction_purpose"] | null;
          regular_price: number | null;
          sales_price: number | null;
          search_vector: unknown;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          state: string | null;
          status: Database["public"]["Enums"]["property_status"];
          title: string;
          title_documentation: string | null;
          toilets: number | null;
          updated_at: string;
          updated_by: string | null;
          youtube_video_id: string | null;
        };
        Insert: {
          address?: string | null;
          available_plots?: number | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          building_type_id?: string | null;
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          description_html?: string | null;
          dimensions?: string | null;
          discount_percent?: number | null;
          duplicate_of?: string | null;
          duplicate_reviewed_at?: string | null;
          duplicate_reviewed_by?: string | null;
          duplicate_state?: Database["public"]["Enums"]["duplicate_state"];
          effective_price?: number | null;
          estate_id?: string | null;
          featured_order?: number | null;
          features?: string[];
          google_maps_url?: string | null;
          id?: string;
          instalment_note?: string | null;
          instalment_price?: number | null;
          is_featured?: boolean;
          kind: Database["public"]["Enums"]["property_kind"];
          land_size?: number | null;
          land_size_unit?: Database["public"]["Enums"]["land_size_unit"] | null;
          land_use?: Database["public"]["Enums"]["land_use"] | null;
          location_text?: string | null;
          og_image_path?: string | null;
          parking_spaces?: number | null;
          price_period?: Database["public"]["Enums"]["price_period"] | null;
          promotion_active?: boolean;
          published_at?: string | null;
          purpose?: Database["public"]["Enums"]["transaction_purpose"] | null;
          regular_price?: number | null;
          sales_price?: number | null;
          search_vector?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["property_status"];
          title: string;
          title_documentation?: string | null;
          toilets?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          youtube_video_id?: string | null;
        };
        Update: {
          address?: string | null;
          available_plots?: number | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          building_type_id?: string | null;
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          description_html?: string | null;
          dimensions?: string | null;
          discount_percent?: number | null;
          duplicate_of?: string | null;
          duplicate_reviewed_at?: string | null;
          duplicate_reviewed_by?: string | null;
          duplicate_state?: Database["public"]["Enums"]["duplicate_state"];
          effective_price?: number | null;
          estate_id?: string | null;
          featured_order?: number | null;
          features?: string[];
          google_maps_url?: string | null;
          id?: string;
          instalment_note?: string | null;
          instalment_price?: number | null;
          is_featured?: boolean;
          kind?: Database["public"]["Enums"]["property_kind"];
          land_size?: number | null;
          land_size_unit?: Database["public"]["Enums"]["land_size_unit"] | null;
          land_use?: Database["public"]["Enums"]["land_use"] | null;
          location_text?: string | null;
          og_image_path?: string | null;
          parking_spaces?: number | null;
          price_period?: Database["public"]["Enums"]["price_period"] | null;
          promotion_active?: boolean;
          published_at?: string | null;
          purpose?: Database["public"]["Enums"]["transaction_purpose"] | null;
          regular_price?: number | null;
          sales_price?: number | null;
          search_vector?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["property_status"];
          title?: string;
          title_documentation?: string | null;
          toilets?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          youtube_video_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "properties_building_type_id_fkey";
            columns: ["building_type_id"];
            isOneToOne: false;
            referencedRelation: "building_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "properties_duplicate_of_fkey";
            columns: ["duplicate_of"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "properties_duplicate_of_fkey";
            columns: ["duplicate_of"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "properties_estate_id_fkey";
            columns: ["estate_id"];
            isOneToOne: false;
            referencedRelation: "estates";
            referencedColumns: ["id"];
          },
        ];
      };
      property_images: {
        Row: {
          alt_text: string | null;
          created_at: string;
          height: number | null;
          id: string;
          is_cover: boolean;
          property_id: string;
          sort_order: number;
          storage_path: string;
          width: number | null;
        };
        Insert: {
          alt_text?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          is_cover?: boolean;
          property_id: string;
          sort_order?: number;
          storage_path: string;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          is_cover?: boolean;
          property_id?: string;
          sort_order?: number;
          storage_path?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_images_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      security_events: {
        Row: {
          actor_email: string | null;
          actor_id: string | null;
          created_at: string;
          email_hash: string | null;
          event_type: string;
          id: number;
          ip_hash: string | null;
          metadata: Json;
          user_agent: string | null;
        };
        Insert: {
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          email_hash?: string | null;
          event_type: string;
          id?: never;
          ip_hash?: string | null;
          metadata?: Json;
          user_agent?: string | null;
        };
        Update: {
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          email_hash?: string | null;
          event_type?: string;
          id?: never;
          ip_hash?: string | null;
          metadata?: Json;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          address: string | null;
          business_hours: Json;
          company_name: string | null;
          default_og_image_path: string | null;
          default_seo_description: string | null;
          default_seo_title: string | null;
          email_primary: string | null;
          ga_measurement_id: string | null;
          id: number;
          map_embed_url: string | null;
          phone_primary: string | null;
          phone_secondary: string | null;
          social_links: Json;
          tagline: string | null;
          updated_at: string;
          whatsapp_number: string | null;
        };
        Insert: {
          address?: string | null;
          business_hours?: Json;
          company_name?: string | null;
          default_og_image_path?: string | null;
          default_seo_description?: string | null;
          default_seo_title?: string | null;
          email_primary?: string | null;
          ga_measurement_id?: string | null;
          id?: number;
          map_embed_url?: string | null;
          phone_primary?: string | null;
          phone_secondary?: string | null;
          social_links?: Json;
          tagline?: string | null;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Update: {
          address?: string | null;
          business_hours?: Json;
          company_name?: string | null;
          default_og_image_path?: string | null;
          default_seo_description?: string | null;
          default_seo_title?: string | null;
          email_primary?: string | null;
          ga_measurement_id?: string | null;
          id?: number;
          map_embed_url?: string | null;
          phone_primary?: string | null;
          phone_secondary?: string | null;
          social_links?: Json;
          tagline?: string | null;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          bio: string | null;
          department: string | null;
          id: string;
          is_active: boolean;
          name: string;
          photo_path: string | null;
          position: string | null;
          social_links: Json;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          department?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          photo_path?: string | null;
          position?: string | null;
          social_links?: Json;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          department?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          photo_path?: string | null;
          position?: string | null;
          social_links?: Json;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      top_banners: {
        Row: {
          cta_label: string | null;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          link_url: string | null;
          message: string;
          starts_at: string | null;
          type: Database["public"]["Enums"]["banner_type"];
          updated_at: string;
        };
        Insert: {
          cta_label?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          link_url?: string | null;
          message: string;
          starts_at?: string | null;
          type?: Database["public"]["Enums"]["banner_type"];
          updated_at?: string;
        };
        Update: {
          cta_label?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          link_url?: string | null;
          message?: string;
          starts_at?: string | null;
          type?: Database["public"]["Enums"]["banner_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      why_choose_us_items: {
        Row: {
          description: string | null;
          icon_key: string | null;
          id: string;
          is_active: boolean;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          description?: string | null;
          icon_key?: string | null;
          id?: string;
          is_active?: boolean;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          description?: string | null;
          icon_key?: string | null;
          id?: string;
          is_active?: boolean;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      my_inspection_requests: {
        Row: {
          created_at: string | null;
          id: string | null;
          message: string | null;
          preferred_date: string | null;
          preferred_time: string | null;
          property_id: string | null;
          property_snapshot: Json | null;
          status: Database["public"]["Enums"]["inspection_status"] | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string | null;
          message?: string | null;
          preferred_date?: string | null;
          preferred_time?: string | null;
          property_id?: string | null;
          property_snapshot?: Json | null;
          status?: Database["public"]["Enums"]["inspection_status"] | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string | null;
          message?: string | null;
          preferred_date?: string | null;
          preferred_time?: string | null;
          property_id?: string | null;
          property_snapshot?: Json | null;
          status?: Database["public"]["Enums"]["inspection_status"] | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_requests_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_requests_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      property_listing_images: {
        Row: {
          alt_text: string | null;
          height: number | null;
          id: string | null;
          is_cover: boolean | null;
          property_id: string | null;
          sort_order: number | null;
          storage_path: string | null;
          width: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_images_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      property_listings: {
        Row: {
          address: string | null;
          available_plots: number | null;
          bathrooms: number | null;
          bedrooms: number | null;
          building_type: string | null;
          building_type_id: string | null;
          building_type_slug: string | null;
          city: string | null;
          cover_image_path: string | null;
          description: string | null;
          description_html: string | null;
          dimensions: string | null;
          discount_percent: number | null;
          effective_price: number | null;
          featured_order: number | null;
          features: string[] | null;
          google_maps_url: string | null;
          id: string | null;
          instalment_note: string | null;
          instalment_price: number | null;
          is_featured: boolean | null;
          kind: Database["public"]["Enums"]["property_kind"] | null;
          land_size: number | null;
          land_size_unit: Database["public"]["Enums"]["land_size_unit"] | null;
          land_use: Database["public"]["Enums"]["land_use"] | null;
          location_text: string | null;
          og_image_path: string | null;
          parking_spaces: number | null;
          price_period: Database["public"]["Enums"]["price_period"] | null;
          promotion_active: boolean | null;
          published_at: string | null;
          purpose: Database["public"]["Enums"]["transaction_purpose"] | null;
          regular_price: number | null;
          sales_price: number | null;
          search_vector: unknown;
          seo_description: string | null;
          seo_title: string | null;
          slug: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["property_status"] | null;
          title: string | null;
          title_documentation: string | null;
          toilets: number | null;
          updated_at: string | null;
          youtube_video_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "properties_building_type_id_fkey";
            columns: ["building_type_id"];
            isOneToOne: false;
            referencedRelation: "building_types";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      admin_otp_issue: {
        Args: {
          p_code_hash: string;
          p_cooldown_seconds?: number;
          p_max_per_session?: number;
          p_session_id: string;
          p_ttl_seconds?: number;
        };
        Returns: string;
      };
      admin_otp_verify: {
        Args: { p_code_hash: string; p_session_id: string };
        Returns: string;
      };
      admin_recovery_complete: {
        Args: { p_admin_id: string; p_session_id: string };
        Returns: boolean;
      };
      admin_recovery_is_valid: {
        Args: { p_admin_id: string; p_session_id: string };
        Returns: boolean;
      };
      admin_recovery_start: {
        Args: { p_admin_id: string; p_session_id: string };
        Returns: boolean;
      };
      admin_session_create: {
        Args: {
          p_admin_id: string;
          p_ip_hash?: string;
          p_session_id: string;
          p_ttl: string;
          p_user_agent?: string;
        };
        Returns: undefined;
      };
      admin_session_mark_verified: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      admin_session_revoke: {
        Args: { p_admin_id: string; p_session_id?: string };
        Returns: number;
      };
      admin_session_status: { Args: never; Returns: string };
      admin_session_touch: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      find_property_duplicate: {
        Args: {
          p_kind: Database["public"]["Enums"]["property_kind"];
          p_land_size?: number;
          p_land_size_unit?: Database["public"]["Enums"]["land_size_unit"];
          p_location_text: string;
          p_title: string;
        };
        Returns: {
          id: string;
          status: Database["public"]["Enums"]["property_status"];
          title: string;
        }[];
      };
      find_property_duplicates: {
        Args: {
          p_kind: Database["public"]["Enums"]["property_kind"];
          p_rows: Json;
        };
        Returns: {
          id: string;
          idx: number;
          title: string;
        }[];
      };
      log_activity: {
        Args: {
          p_action: string;
          p_entity_id?: string;
          p_entity_type?: string;
          p_metadata?: Json;
        };
        Returns: undefined;
      };
      log_activity_as: {
        Args: {
          p_action: string;
          p_actor_id: string;
          p_actor_type: string;
          p_entity_id?: string;
          p_entity_type?: string;
          p_ip_hash?: string;
          p_metadata?: Json;
        };
        Returns: undefined;
      };
      log_security_event: {
        Args: {
          p_actor_id?: string;
          p_email_hash?: string;
          p_event_type: string;
          p_ip_hash?: string;
          p_metadata?: Json;
          p_user_agent?: string;
        };
        Returns: undefined;
      };
      my_admin_permissions: {
        Args: never;
        Returns: {
          can_create: boolean;
          can_delete: boolean;
          can_edit: boolean;
          can_publish: boolean;
          can_view: boolean;
          is_super_admin: boolean;
          module: Database["public"]["Enums"]["admin_module"];
        }[];
      };
      reorder_property_images: {
        Args: { p_image_ids: string[]; p_property_id: string };
        Returns: undefined;
      };
      set_property_cover: {
        Args: { p_image_id: string; p_property_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      admin_action: "view" | "create" | "edit" | "publish" | "delete";
      admin_module:
        | "properties"
        | "estates"
        | "inspections"
        | "enquiries"
        | "blog"
        | "content"
        | "marketing"
        | "newsletter"
        | "customers"
        | "media"
        | "settings"
        | "admins"
        | "analytics"
        | "cookies"
        | "activity_logs";
      admin_role: "super_admin" | "sub_admin";
      announcement_frequency: "once" | "once_per_days" | "once_per_session";
      banner_type: "information" | "promotion" | "notice";
      duplicate_state: "none" | "flagged" | "cleared";
      import_status: "validated" | "imported" | "discarded";
      inspection_status: "pending" | "confirmed" | "completed" | "cancelled";
      land_size_unit: "sqm" | "plot" | "acre" | "hectare";
      land_use: "residential" | "commercial" | "agricultural";
      newsletter_status: "pending" | "active" | "unsubscribed";
      post_status: "draft" | "published";
      price_period: "per_week" | "per_month" | "per_year";
      property_kind: "land" | "building";
      property_status: "draft" | "published" | "unavailable" | "archived";
      transaction_purpose: "sale" | "rent" | "lease";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      admin_action: ["view", "create", "edit", "publish", "delete"],
      admin_module: [
        "properties",
        "estates",
        "inspections",
        "enquiries",
        "blog",
        "content",
        "marketing",
        "newsletter",
        "customers",
        "media",
        "settings",
        "admins",
        "analytics",
        "cookies",
        "activity_logs",
      ],
      admin_role: ["super_admin", "sub_admin"],
      announcement_frequency: ["once", "once_per_days", "once_per_session"],
      banner_type: ["information", "promotion", "notice"],
      duplicate_state: ["none", "flagged", "cleared"],
      import_status: ["validated", "imported", "discarded"],
      inspection_status: ["pending", "confirmed", "completed", "cancelled"],
      land_size_unit: ["sqm", "plot", "acre", "hectare"],
      land_use: ["residential", "commercial", "agricultural"],
      newsletter_status: ["pending", "active", "unsubscribed"],
      post_status: ["draft", "published"],
      price_period: ["per_week", "per_month", "per_year"],
      property_kind: ["land", "building"],
      property_status: ["draft", "published", "unavailable", "archived"],
      transaction_purpose: ["sale", "rent", "lease"],
    },
  },
} as const;
