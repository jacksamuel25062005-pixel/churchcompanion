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
      about_church_entries: {
        Row: {
          body_en: string
          body_hi: string | null
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          is_published: boolean
          photo_urls: string[]
          title_en: string
          title_hi: string | null
          updated_at: string
        }
        Insert: {
          body_en: string
          body_hi?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          photo_urls?: string[]
          title_en: string
          title_hi?: string | null
          updated_at?: string
        }
        Update: {
          body_en?: string
          body_hi?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          photo_urls?: string[]
          title_en?: string
          title_hi?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          reason: string | null
          status: Database["public"]["Enums"]["admin_request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["admin_request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["admin_request_status"]
          user_id?: string
        }
        Relationships: []
      }
      almanac_entries: {
        Row: {
          colour: string
          created_at: string
          date: string
          day_name: string
          evening_readings: string[]
          id: string
          is_sunday: boolean
          ls_gospel: string[]
          ls_ot: string[]
          ls_psalm: string[]
          ls_second: string[]
          memorial: string | null
          morning_readings: string[]
          theme: string
          updated_at: string
        }
        Insert: {
          colour?: string
          created_at?: string
          date: string
          day_name?: string
          evening_readings?: string[]
          id?: string
          is_sunday?: boolean
          ls_gospel?: string[]
          ls_ot?: string[]
          ls_psalm?: string[]
          ls_second?: string[]
          memorial?: string | null
          morning_readings?: string[]
          theme?: string
          updated_at?: string
        }
        Update: {
          colour?: string
          created_at?: string
          date?: string
          day_name?: string
          evening_readings?: string[]
          id?: string
          is_sunday?: boolean
          ls_gospel?: string[]
          ls_ot?: string[]
          ls_psalm?: string[]
          ls_second?: string[]
          memorial?: string | null
          morning_readings?: string[]
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          published: boolean
          topic: string
          updated_at: string
        }
        Insert: {
          audience: string
          body?: string
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          published?: boolean
          topic: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          published?: boolean
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      approved_youth: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          name: string
          phone: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json | null
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target?: string | null
        }
        Relationships: []
      }
      book_pages: {
        Row: {
          book_id: string
          created_at: string
          height: number | null
          id: string
          page_number: number
          storage_path: string
          width: number | null
        }
        Insert: {
          book_id: string
          created_at?: string
          height?: number | null
          id?: string
          page_number: number
          storage_path: string
          width?: number | null
        }
        Update: {
          book_id?: string
          created_at?: string
          height?: number | null
          id?: string
          page_number?: number
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "book_pages_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_sections: {
        Row: {
          body_en: string | null
          body_hi: string | null
          book_id: string
          created_at: string
          id: string
          is_deleted: boolean
          number: number | null
          search: unknown
          sort_order: number
          title_en: string | null
          title_hi: string | null
          updated_at: string
        }
        Insert: {
          body_en?: string | null
          body_hi?: string | null
          book_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          number?: number | null
          search?: unknown
          sort_order?: number
          title_en?: string | null
          title_hi?: string | null
          updated_at?: string
        }
        Update: {
          body_en?: string | null
          body_hi?: string | null
          book_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          number?: number | null
          search?: unknown
          sort_order?: number
          title_en?: string | null
          title_hi?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_sections_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          accent_color: string
          created_at: string
          description_en: string | null
          description_hi: string | null
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          title_en: string
          title_hi: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          description_en?: string | null
          description_hi?: string | null
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          title_en: string
          title_hi: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          description_en?: string | null
          description_hi?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          title_en?: string
          title_hi?: string
        }
        Relationships: []
      }
      chat_message_reactions: {
        Row: {
          chat: string
          created_at: string
          emoji: string
          id: string
          message_id: string
          sender_name: string
          sender_ref: string
        }
        Insert: {
          chat: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          sender_name?: string
          sender_ref: string
        }
        Update: {
          chat?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          sender_name?: string
          sender_ref?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          channel: string
          content: string | null
          created_at: string
          deleted: boolean
          id: string
          media_url: string | null
          reply_to: string | null
          sender_name: string
          sender_ref: string
        }
        Insert: {
          channel: string
          content?: string | null
          created_at?: string
          deleted?: boolean
          id?: string
          media_url?: string | null
          reply_to?: string | null
          sender_name: string
          sender_ref: string
        }
        Update: {
          channel?: string
          content?: string | null
          created_at?: string
          deleted?: boolean
          id?: string
          media_url?: string | null
          reply_to?: string | null
          sender_name?: string
          sender_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mutes: {
        Row: {
          created_at: string
          id: string
          muted_until: string
          reason: string | null
          sender_ref: string
        }
        Insert: {
          created_at?: string
          id?: string
          muted_until: string
          reason?: string | null
          sender_ref: string
        }
        Update: {
          created_at?: string
          id?: string
          muted_until?: string
          reason?: string | null
          sender_ref?: string
        }
        Relationships: []
      }
      chat_receipts: {
        Row: {
          chat: string
          delivered_at: string
          id: string
          message_id: string
          read_at: string | null
          reader_ref: string
        }
        Insert: {
          chat: string
          delivered_at?: string
          id?: string
          message_id: string
          read_at?: string | null
          reader_ref: string
        }
        Update: {
          chat?: string
          delivered_at?: string
          id?: string
          message_id?: string
          read_at?: string | null
          reader_ref?: string
        }
        Relationships: []
      }
      chat_reports: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reason: string | null
          reporter_ref: string
          resolved: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reason?: string | null
          reporter_ref: string
          resolved?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reason?: string | null
          reporter_ref?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      church_timeline_articles: {
        Row: {
          article_date: string
          body_en: string
          body_hi: string | null
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          photo_urls: string[]
          title_en: string
          title_hi: string | null
          updated_at: string
        }
        Insert: {
          article_date: string
          body_en: string
          body_hi?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          photo_urls?: string[]
          title_en: string
          title_hi?: string | null
          updated_at?: string
        }
        Update: {
          article_date?: string
          body_en?: string
          body_hi?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          photo_urls?: string[]
          title_en?: string
          title_hi?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      congregation_chat_messages: {
        Row: {
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean
          message_content: string
          phone_number: string
          sender_name: string
        }
        Insert: {
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          message_content: string
          phone_number: string
          sender_name: string
        }
        Update: {
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          message_content?: string
          phone_number?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "congregation_chat_messages_phone_number_fkey"
            columns: ["phone_number"]
            isOneToOne: false
            referencedRelation: "congregation_chat_users"
            referencedColumns: ["phone_number"]
          },
        ]
      }
      congregation_chat_users: {
        Row: {
          is_online: boolean
          joined_at: string
          last_seen: string
          name: string
          phone_number: string
          session_id: string
        }
        Insert: {
          is_online?: boolean
          joined_at?: string
          last_seen?: string
          name: string
          phone_number: string
          session_id?: string
        }
        Update: {
          is_online?: boolean
          joined_at?: string
          last_seen?: string
          name?: string
          phone_number?: string
          session_id?: string
        }
        Relationships: []
      }
      congregation_profiles: {
        Row: {
          created_at: string
          device_session_id: string
          email: string
          id: string
          name: string
          phone: string
          session_token: string
        }
        Insert: {
          created_at?: string
          device_session_id: string
          email: string
          id?: string
          name: string
          phone: string
          session_token: string
        }
        Update: {
          created_at?: string
          device_session_id?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          session_token?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          sender_ref: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          sender_ref: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          sender_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          reader_ref: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          reader_ref: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          reader_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          category: Database["public"]["Enums"]["song_category"]
          created_at: string
          id: string
          is_deleted: boolean
          lyrics_en: string | null
          lyrics_hi: string
          number: number | null
          search: unknown
          tags: string[] | null
          title_en: string | null
          title_hi: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["song_category"]
          created_at?: string
          id?: string
          is_deleted?: boolean
          lyrics_en?: string | null
          lyrics_hi: string
          number?: number | null
          search?: unknown
          tags?: string[] | null
          title_en?: string | null
          title_hi: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["song_category"]
          created_at?: string
          id?: string
          is_deleted?: boolean
          lyrics_en?: string | null
          lyrics_hi?: string
          number?: number | null
          search?: unknown
          tags?: string[] | null
          title_en?: string | null
          title_hi?: string
          updated_at?: string
        }
        Relationships: []
      }
      timeline_article_comments: {
        Row: {
          article_id: string
          comment_text: string
          commenter_name: string
          created_at: string
          id: string
          is_hidden: boolean
        }
        Insert: {
          article_id: string
          comment_text: string
          commenter_name: string
          created_at?: string
          id?: string
          is_hidden?: boolean
        }
        Update: {
          article_id?: string
          comment_text?: string
          commenter_name?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "timeline_article_comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "church_timeline_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_article_likes: {
        Row: {
          article_id: string
          created_at: string
          id: string
          liker_client_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          liker_client_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          liker_client_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_article_likes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "church_timeline_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      today_song_items: {
        Row: {
          id: string
          is_deleted: boolean
          position: number
          set_id: string
          song_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          is_deleted?: boolean
          position?: number
          set_id: string
          song_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          is_deleted?: boolean
          position?: number
          set_id?: string
          song_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "today_song_items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "today_song_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "today_song_items_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      today_song_sets: {
        Row: {
          for_date: string
          id: string
          is_deleted: boolean
          note: string | null
          published_at: string
          published_by: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          for_date: string
          id?: string
          is_deleted?: boolean
          note?: string | null
          published_at?: string
          published_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          for_date?: string
          id?: string
          is_deleted?: boolean
          note?: string | null
          published_at?: string
          published_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      youth_access_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          name: string
          phone_number: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          name: string
          phone_number: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          name?: string
          phone_number?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      youth_chat_messages: {
        Row: {
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean
          message_content: string
          phone_number: string
          sender_name: string
        }
        Insert: {
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          message_content: string
          phone_number: string
          sender_name: string
        }
        Update: {
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          message_content?: string
          phone_number?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "youth_chat_messages_phone_number_fkey"
            columns: ["phone_number"]
            isOneToOne: false
            referencedRelation: "youth_chat_users"
            referencedColumns: ["phone_number"]
          },
        ]
      }
      youth_chat_users: {
        Row: {
          is_online: boolean
          joined_at: string
          last_seen: string
          name: string
          phone_number: string
          session_id: string
        }
        Insert: {
          is_online?: boolean
          joined_at?: string
          last_seen?: string
          name: string
          phone_number: string
          session_id?: string
        }
        Update: {
          is_online?: boolean
          joined_at?: string
          last_seen?: string
          name?: string
          phone_number?: string
          session_id?: string
        }
        Relationships: []
      }
      youth_phone_whitelist: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          name: string
          phone_number: string
          source: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          name: string
          phone_number: string
          source?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          name?: string
          phone_number?: string
          source?: string
        }
        Relationships: []
      }
      youth_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          youth_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          token: string
          youth_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          youth_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youth_sessions_youth_id_fkey"
            columns: ["youth_id"]
            isOneToOne: false
            referencedRelation: "approved_youth"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_message: { Args: { _id: string }; Returns: boolean }
      chat_delete_message: {
        Args: { _chat: string; _id: string }
        Returns: undefined
      }
      chat_edit_message: {
        Args: { _chat: string; _content: string; _id: string }
        Returns: undefined
      }
      chat_heartbeat: { Args: { _chat: string }; Returns: undefined }
      chat_mark_receipts: {
        Args: { _chat: string; _ids: string[]; _read: boolean }
        Returns: undefined
      }
      chat_react: {
        Args: { _chat: string; _emoji: string; _message_id: string }
        Returns: string
      }
      chat_receipt_state: {
        Args: { _chat: string; _ids: string[] }
        Returns: {
          audience: number
          delivered_count: number
          message_id: string
          read_count: number
        }[]
      }
      chat_send: { Args: { _chat: string; _content: string }; Returns: string }
      chat_session_info: {
        Args: { _chat: string; _session: string }
        Returns: {
          name: string
          phone_number: string
        }[]
      }
      congregation_admin_remove_user: {
        Args: { _phone: string }
        Returns: undefined
      }
      congregation_admin_update_user: {
        Args: { _name: string; _phone: string }
        Returns: undefined
      }
      congregation_admin_users: {
        Args: never
        Returns: {
          is_online: boolean
          joined_at: string
          last_seen: string
          message_count: number
          name: string
          phone_number: string
        }[]
      }
      congregation_join: {
        Args: { _name: string; _phone: string }
        Returns: {
          name: string
          phone_number: string
          session_id: string
        }[]
      }
      congregation_register: {
        Args: { _email: string; _name: string; _phone: string }
        Returns: string
      }
      congregation_session_exists: { Args: { _sid: string }; Returns: boolean }
      current_chat_session: { Args: never; Returns: string }
      current_congregation_ref: { Args: never; Returns: string }
      current_congregation_token: { Args: never; Returns: string }
      current_youth_id: { Args: never; Returns: string }
      current_youth_token: { Args: never; Returns: string }
      has_congregation_session: { Args: never; Returns: boolean }
      has_youth_session: { Args: never; Returns: boolean }
      is_chat_admin: { Args: { _uid: string }; Returns: boolean }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      like_timeline_article: {
        Args: { p_article_id: string; p_client_secret: string }
        Returns: undefined
      }
      normalize_phone: { Args: { _p: string }; Returns: string }
      search_content: {
        Args: { q: string }
        Returns: {
          book_slug: string
          id: string
          kind: string
          number: number
          snippet: string
          title: string
        }[]
      }
      server_now: { Args: never; Returns: string }
      sync_pull: { Args: { since?: string }; Returns: Json }
      timeline_like_state: {
        Args: { p_article_id: string; p_client_secret: string }
        Returns: {
          liked: boolean
          total: number
        }[]
      }
      unlike_timeline_article: {
        Args: { p_article_id: string; p_client_secret: string }
        Returns: undefined
      }
      validate_chat_input: {
        Args: { _name: string; _phone: string }
        Returns: undefined
      }
      youth_check_phone: {
        Args: { _phone: string }
        Returns: {
          name: string
          token: string
          youth_id: string
        }[]
      }
      youth_join: {
        Args: { _phone: string }
        Returns: {
          name: string
          phone_number: string
          session_id: string
        }[]
      }
      youth_refresh_session: {
        Args: { _token: string }
        Returns: {
          name: string
          token: string
          youth_id: string
        }[]
      }
      youth_request_access: {
        Args: { _message?: string; _name: string; _phone: string }
        Returns: string
      }
      youth_request_status: {
        Args: { _phone: string }
        Returns: {
          created_at: string
          rejection_reason: string
          status: string
        }[]
      }
      youth_review_request: {
        Args: { _approve: boolean; _id: string; _reason?: string }
        Returns: undefined
      }
    }
    Enums: {
      admin_request_status: "pending" | "approved" | "rejected"
      app_role: "super_admin" | "admin"
      song_category: "church" | "additional"
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
      admin_request_status: ["pending", "approved", "rejected"],
      app_role: ["super_admin", "admin"],
      song_category: ["church", "additional"],
    },
  },
} as const
