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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      acceptance_reports: {
        Row: {
          cohort_round: string | null
          id: string
          outcome: Database["public"]["Enums"]["outcome_type"]
          program_id: string
          reported_at: string
          reported_by: string
          verified: boolean
        }
        Insert: {
          cohort_round?: string | null
          id?: string
          outcome: Database["public"]["Enums"]["outcome_type"]
          program_id: string
          reported_at?: string
          reported_by: string
          verified?: boolean
        }
        Update: {
          cohort_round?: string | null
          id?: string
          outcome?: Database["public"]["Enums"]["outcome_type"]
          program_id?: string
          reported_at?: string
          reported_by?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "acceptance_reports_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acceptance_reports_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_draft_runs: {
        Row: {
          application_answer_id: string | null
          archived_question_id: string | null
          completion_tokens: number | null
          created_at: string
          id: string
          integration_id: string | null
          integration_type: string | null
          model_used: string | null
          output_content: string
          program_id: string | null
          prompt_tokens: number | null
          prompt_used: string | null
          score_alignment: number | null
          score_authenticity: number | null
          score_composite: number | null
          score_fluency: number | null
          score_specificity: number | null
          user_id: string
          word_count: number
        }
        Insert: {
          application_answer_id?: string | null
          archived_question_id?: string | null
          completion_tokens?: number | null
          created_at?: string
          id?: string
          integration_id?: string | null
          integration_type?: string | null
          model_used?: string | null
          output_content: string
          program_id?: string | null
          prompt_tokens?: number | null
          prompt_used?: string | null
          score_alignment?: number | null
          score_authenticity?: number | null
          score_composite?: number | null
          score_fluency?: number | null
          score_specificity?: number | null
          user_id: string
          word_count?: number
        }
        Update: {
          application_answer_id?: string | null
          archived_question_id?: string | null
          completion_tokens?: number | null
          created_at?: string
          id?: string
          integration_id?: string | null
          integration_type?: string | null
          model_used?: string | null
          output_content?: string
          program_id?: string | null
          prompt_tokens?: number | null
          prompt_used?: string | null
          score_alignment?: number | null
          score_authenticity?: number | null
          score_composite?: number | null
          score_fluency?: number | null
          score_specificity?: number | null
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_draft_runs_application_answer_id_fkey"
            columns: ["application_answer_id"]
            isOneToOne: false
            referencedRelation: "application_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_draft_runs_archived_question_id_fkey"
            columns: ["archived_question_id"]
            isOneToOne: false
            referencedRelation: "archived_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_draft_runs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "connected_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_draft_runs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_draft_runs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          draft_count: number
          id: string
          month_year: string
          updated_at: string
          user_id: string
        }
        Insert: {
          draft_count?: number
          id?: string
          month_year: string
          updated_at?: string
          user_id: string
        }
        Update: {
          draft_count?: number
          id?: string
          month_year?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      answer_reviews: {
        Row: {
          archived_question_id: string | null
          certification: Json | null
          comments: Json
          created_at: string
          id: string
          model_used: string | null
          overall_status: string
          profile_answer_id: string
          program_id: string | null
          provider: string | null
          reviewer_name: string
          reviewer_type: string
          reviewer_version: string | null
          scores: Json
          source_tool: string
          summary: string
          user_id: string
        }
        Insert: {
          archived_question_id?: string | null
          certification?: Json | null
          comments?: Json
          created_at?: string
          id?: string
          model_used?: string | null
          overall_status: string
          profile_answer_id: string
          program_id?: string | null
          provider?: string | null
          reviewer_name?: string
          reviewer_type?: string
          reviewer_version?: string | null
          scores?: Json
          source_tool?: string
          summary: string
          user_id: string
        }
        Update: {
          archived_question_id?: string | null
          certification?: Json | null
          comments?: Json
          created_at?: string
          id?: string
          model_used?: string | null
          overall_status?: string
          profile_answer_id?: string
          program_id?: string | null
          provider?: string | null
          reviewer_name?: string
          reviewer_type?: string
          reviewer_version?: string | null
          scores?: Json
          source_tool?: string
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_reviews_archived_question_id_fkey"
            columns: ["archived_question_id"]
            isOneToOne: false
            referencedRelation: "archived_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_reviews_profile_answer_id_fkey"
            columns: ["profile_answer_id"]
            isOneToOne: false
            referencedRelation: "profile_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_reviews_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_reviews_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_stress_tests: {
        Row: {
          archived_question_id: string | null
          checklist: Json
          created_at: string
          depth: Database["public"]["Enums"]["answer_stress_depth"]
          detected_signals: Json
          fidelity_certificate: Json | null
          follow_up_prompts: Json
          id: string
          mode: string
          model_used: string | null
          persisted_from_tool: string
          profile_answer_id: string
          program_id: string | null
          prompt_used: string | null
          provider: string | null
          risk_flags: Json
          score_payload: Json | null
          user_id: string
        }
        Insert: {
          archived_question_id?: string | null
          checklist?: Json
          created_at?: string
          depth?: Database["public"]["Enums"]["answer_stress_depth"]
          detected_signals?: Json
          fidelity_certificate?: Json | null
          follow_up_prompts?: Json
          id?: string
          mode?: string
          model_used?: string | null
          persisted_from_tool?: string
          profile_answer_id: string
          program_id?: string | null
          prompt_used?: string | null
          provider?: string | null
          risk_flags?: Json
          score_payload?: Json | null
          user_id: string
        }
        Update: {
          archived_question_id?: string | null
          checklist?: Json
          created_at?: string
          depth?: Database["public"]["Enums"]["answer_stress_depth"]
          detected_signals?: Json
          fidelity_certificate?: Json | null
          follow_up_prompts?: Json
          id?: string
          mode?: string
          model_used?: string | null
          persisted_from_tool?: string
          profile_answer_id?: string
          program_id?: string | null
          prompt_used?: string | null
          provider?: string | null
          risk_flags?: Json
          score_payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_stress_tests_archived_question_id_fkey"
            columns: ["archived_question_id"]
            isOneToOne: false
            referencedRelation: "archived_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_stress_tests_profile_answer_id_fkey"
            columns: ["profile_answer_id"]
            isOneToOne: false
            referencedRelation: "profile_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_stress_tests_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_stress_tests_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      app_import_sessions: {
        Row: {
          created_at: string
          domain: string
          error_text: string | null
          extracted_count: number
          extracted_pairs: Json | null
          id: string
          program_name: string | null
          raw_text: string
          saved_count: number | null
          source_kind: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain?: string
          error_text?: string | null
          extracted_count?: number
          extracted_pairs?: Json | null
          id?: string
          program_name?: string | null
          raw_text: string
          saved_count?: number | null
          source_kind?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          error_text?: string | null
          extracted_count?: number
          extracted_pairs?: Json | null
          id?: string
          program_name?: string | null
          raw_text?: string
          saved_count?: number | null
          source_kind?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      application_answers: {
        Row: {
          application_id: string
          content: string
          created_at: string
          divergence_pct: number | null
          id: string
          is_canonical: boolean
          program_question_id: string
          sourced_from_profile: boolean
          updated_at: string
          user_id: string
          version: number
          word_count: number
        }
        Insert: {
          application_id: string
          content?: string
          created_at?: string
          divergence_pct?: number | null
          id?: string
          is_canonical?: boolean
          program_question_id: string
          sourced_from_profile?: boolean
          updated_at?: string
          user_id: string
          version?: number
          word_count?: number
        }
        Update: {
          application_id?: string
          content?: string
          created_at?: string
          divergence_pct?: number | null
          id?: string
          is_canonical?: boolean
          program_question_id?: string
          sourced_from_profile?: boolean
          updated_at?: string
          user_id?: string
          version?: number
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "user_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_program_question_id_fkey"
            columns: ["program_question_id"]
            isOneToOne: false
            referencedRelation: "program_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_questions: {
        Row: {
          applicable_kinds: Database["public"]["Enums"]["opportunity_kind"][]
          asked_by_count: number
          avg_word_limit: number | null
          created_at: string
          domain: string
          embedding: string | null
          example_programs: string[] | null
          id: string
          importance_score: number
          is_universal: boolean
          question_archetype: string | null
          response_type: Database["public"]["Enums"]["response_type"]
          significance_score: number
          subtheme: string | null
          text: string
          theme: string
          theme_weight: number | null
          typical_word_limit: number | null
          universal_theme: string | null
          updated_at: string
        }
        Insert: {
          applicable_kinds?: Database["public"]["Enums"]["opportunity_kind"][]
          asked_by_count?: number
          avg_word_limit?: number | null
          created_at?: string
          domain?: string
          embedding?: string | null
          example_programs?: string[] | null
          id?: string
          importance_score?: number
          is_universal?: boolean
          question_archetype?: string | null
          response_type?: Database["public"]["Enums"]["response_type"]
          significance_score?: number
          subtheme?: string | null
          text: string
          theme: string
          theme_weight?: number | null
          typical_word_limit?: number | null
          universal_theme?: string | null
          updated_at?: string
        }
        Update: {
          applicable_kinds?: Database["public"]["Enums"]["opportunity_kind"][]
          asked_by_count?: number
          avg_word_limit?: number | null
          created_at?: string
          domain?: string
          embedding?: string | null
          example_programs?: string[] | null
          id?: string
          importance_score?: number
          is_universal?: boolean
          question_archetype?: string | null
          response_type?: Database["public"]["Enums"]["response_type"]
          significance_score?: number
          subtheme?: string | null
          text?: string
          theme?: string
          theme_weight?: number | null
          typical_word_limit?: number | null
          universal_theme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      connected_integrations: {
        Row: {
          config: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          type: Database["public"]["Enums"]["integration_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          type: Database["public"]["Enums"]["integration_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          type?: Database["public"]["Enums"]["integration_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_events: {
        Row: {
          amount: number
          created_at: string
          dedup_key: string | null
          event_type: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          dedup_key?: string | null
          event_type: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          dedup_key?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      deadline_alerts: {
        Row: {
          alert_window: string
          created_at: string
          id: string
          program_id: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          alert_window: string
          created_at?: string
          id?: string
          program_id: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          alert_window?: string
          created_at?: string
          id?: string
          program_id?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadline_alerts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadline_alerts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      funders: {
        Row: {
          created_at: string
          description: string | null
          domain: string
          founded_year: number | null
          hq_location: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          type: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain?: string
          founded_year?: number | null
          hq_location?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          type?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          domain?: string
          founded_year?: number | null
          hq_location?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          type?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      import_queue: {
        Row: {
          confidence_score: number | null
          created_at: string
          domain: string
          id: string
          kind: Database["public"]["Enums"]["opportunity_kind"] | null
          mapped_to: string | null
          metadata: Json
          notes: string | null
          program_id: string | null
          raw_text: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["import_status"]
          submitted_at: string
          submitted_by: string | null
          url: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          domain?: string
          id?: string
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          mapped_to?: string | null
          metadata?: Json
          notes?: string | null
          program_id?: string | null
          raw_text?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          submitted_at?: string
          submitted_by?: string | null
          url?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          domain?: string
          id?: string
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          mapped_to?: string | null
          metadata?: Json
          notes?: string | null
          program_id?: string | null
          raw_text?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          submitted_at?: string
          submitted_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_queue_mapped_to_fkey"
            columns: ["mapped_to"]
            isOneToOne: false
            referencedRelation: "archived_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_queue_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_queue_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_answer_history: {
        Row: {
          content: string
          id: string
          profile_answer_id: string
          saved_at: string
          version: number
          word_count: number
        }
        Insert: {
          content: string
          id?: string
          profile_answer_id: string
          saved_at?: string
          version: number
          word_count?: number
        }
        Update: {
          content?: string
          id?: string
          profile_answer_id?: string
          saved_at?: string
          version?: number
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_answer_history_profile_answer_id_fkey"
            columns: ["profile_answer_id"]
            isOneToOne: false
            referencedRelation: "profile_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_answers: {
        Row: {
          answer_content: string
          archived_question_id: string
          confidence: Database["public"]["Enums"]["answer_confidence"]
          content: string
          created_at: string
          id: string
          last_updated: string
          question_text: string
          theme: string | null
          updated_at: string
          user_id: string
          version: number
          word_count: number
        }
        Insert: {
          answer_content?: string
          archived_question_id: string
          confidence?: Database["public"]["Enums"]["answer_confidence"]
          content?: string
          created_at?: string
          id?: string
          last_updated?: string
          question_text?: string
          theme?: string | null
          updated_at?: string
          user_id: string
          version?: number
          word_count?: number
        }
        Update: {
          answer_content?: string
          archived_question_id?: string
          confidence?: Database["public"]["Enums"]["answer_confidence"]
          content?: string
          created_at?: string
          id?: string
          last_updated?: string
          question_text?: string
          theme?: string | null
          updated_at?: string
          user_id?: string
          version?: number
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_answers_archived_question_id_fkey"
            columns: ["archived_question_id"]
            isOneToOne: false
            referencedRelation: "archived_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      program_dna: {
        Row: {
          computed_at: string
          id: string
          program_id: string
          question_count: number
          theme: string
          weight_pct: number
          word_limit_sum: number
        }
        Insert: {
          computed_at?: string
          id?: string
          program_id: string
          question_count?: number
          theme: string
          weight_pct?: number
          word_limit_sum?: number
        }
        Update: {
          computed_at?: string
          id?: string
          program_id?: string
          question_count?: number
          theme?: string
          weight_pct?: number
          word_limit_sum?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_dna_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_dna_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_listings: {
        Row: {
          amount_paid_cents: number
          created_at: string
          expires_at: string | null
          funder_user_id: string | null
          id: string
          program_id: string
          starts_at: string
          status: Database["public"]["Enums"]["listing_status"]
          stripe_payment_intent: string | null
          tier: Database["public"]["Enums"]["listing_tier"]
          updated_at: string
        }
        Insert: {
          amount_paid_cents?: number
          created_at?: string
          expires_at?: string | null
          funder_user_id?: string | null
          id?: string
          program_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["listing_status"]
          stripe_payment_intent?: string | null
          tier?: Database["public"]["Enums"]["listing_tier"]
          updated_at?: string
        }
        Update: {
          amount_paid_cents?: number
          created_at?: string
          expires_at?: string | null
          funder_user_id?: string | null
          id?: string
          program_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["listing_status"]
          stripe_payment_intent?: string | null
          tier?: Database["public"]["Enums"]["listing_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_listings_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_listings_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_questions: {
        Row: {
          archived_question_id: string
          asked_as: string
          char_limit: number | null
          created_at: string
          id: string
          is_required: boolean
          order_index: number
          program_id: string
          section: string | null
          word_limit: number | null
        }
        Insert: {
          archived_question_id: string
          asked_as: string
          char_limit?: number | null
          created_at?: string
          id?: string
          is_required?: boolean
          order_index?: number
          program_id: string
          section?: string | null
          word_limit?: number | null
        }
        Update: {
          archived_question_id?: string
          asked_as?: string
          char_limit?: number | null
          created_at?: string
          id?: string
          is_required?: boolean
          order_index?: number
          program_id?: string
          section?: string | null
          word_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_questions_archived_question_id_fkey"
            columns: ["archived_question_id"]
            isOneToOne: false
            referencedRelation: "archived_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_questions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_questions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_signals: {
        Row: {
          created_at: string
          id: string
          program_id: string
          signal_type: Database["public"]["Enums"]["signal_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          signal_type: Database["public"]["Enums"]["signal_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          signal_type?: Database["public"]["Enums"]["signal_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_signals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_signals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_stats: {
        Row: {
          acceptance_rate: number | null
          application_count: number
          last_submission_at: string | null
          mean_score: number | null
          program_id: string
          score_distribution: Json | null
          trending_score: number
          updated_at: string
        }
        Insert: {
          acceptance_rate?: number | null
          application_count?: number
          last_submission_at?: string | null
          mean_score?: number | null
          program_id: string
          score_distribution?: Json | null
          trending_score?: number
          updated_at?: string
        }
        Update: {
          acceptance_rate?: number | null
          application_count?: number
          last_submission_at?: string | null
          mean_score?: number | null
          program_id?: string
          score_distribution?: Json | null
          trending_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_stats_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_stats_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          applicant_count: number
          apply_url: string | null
          best_for: string | null
          brand_score: number | null
          cash_value_usd: number | null
          check_size_max: number | null
          check_size_min: number | null
          closes_at: string | null
          cohort_name: string | null
          cohort_size: number | null
          cons: string[] | null
          cost_to_apply_cents: number | null
          created_at: string
          credit_value_usd: number | null
          deadline_at: string | null
          degree_level: string | null
          description: string | null
          details: Json
          details_schema_version: number
          domain: string
          employment_type: string | null
          equity_pct: number | null
          equity_taken: number | null
          expected_reward_cents_max: number | null
          expected_reward_cents_min: number | null
          follow_on_rate_pct: number | null
          funder_id: string | null
          funder_type: string | null
          funder_user_id: string | null
          funding_amount_cents: number | null
          geo_focus: string[] | null
          gmat_required: boolean | null
          gre_required: boolean | null
          heat_score: number
          id: string
          industry_tags: string[] | null
          is_rolling: boolean
          kind: Database["public"]["Enums"]["opportunity_kind"] | null
          last_scraped_at: string | null
          location_city: string | null
          location_country: string | null
          logo_url: string | null
          match_required: boolean | null
          name: string
          network_score: number | null
          opens_at: string | null
          organization: string
          parent_program_id: string | null
          program_length_months: number | null
          program_start_date: string | null
          program_value_score: number | null
          pros: string[] | null
          remote_ok: boolean | null
          results_at: string | null
          round: string | null
          salary_max_cents: number | null
          salary_min_cents: number | null
          scrape_url: string | null
          seniority: string | null
          slug: string
          source: Database["public"]["Enums"]["program_source"]
          status: Database["public"]["Enums"]["program_status"]
          tldr: string | null
          tuition_cents: number | null
          type: Database["public"]["Enums"]["program_type"]
          updated_at: string
          url: string | null
          visa_sponsorship: boolean | null
        }
        Insert: {
          applicant_count?: number
          apply_url?: string | null
          best_for?: string | null
          brand_score?: number | null
          cash_value_usd?: number | null
          check_size_max?: number | null
          check_size_min?: number | null
          closes_at?: string | null
          cohort_name?: string | null
          cohort_size?: number | null
          cons?: string[] | null
          cost_to_apply_cents?: number | null
          created_at?: string
          credit_value_usd?: number | null
          deadline_at?: string | null
          degree_level?: string | null
          description?: string | null
          details?: Json
          details_schema_version?: number
          domain?: string
          employment_type?: string | null
          equity_pct?: number | null
          equity_taken?: number | null
          expected_reward_cents_max?: number | null
          expected_reward_cents_min?: number | null
          follow_on_rate_pct?: number | null
          funder_id?: string | null
          funder_type?: string | null
          funder_user_id?: string | null
          funding_amount_cents?: number | null
          geo_focus?: string[] | null
          gmat_required?: boolean | null
          gre_required?: boolean | null
          heat_score?: number
          id?: string
          industry_tags?: string[] | null
          is_rolling?: boolean
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          last_scraped_at?: string | null
          location_city?: string | null
          location_country?: string | null
          logo_url?: string | null
          match_required?: boolean | null
          name: string
          network_score?: number | null
          opens_at?: string | null
          organization: string
          parent_program_id?: string | null
          program_length_months?: number | null
          program_start_date?: string | null
          program_value_score?: number | null
          pros?: string[] | null
          remote_ok?: boolean | null
          results_at?: string | null
          round?: string | null
          salary_max_cents?: number | null
          salary_min_cents?: number | null
          scrape_url?: string | null
          seniority?: string | null
          slug: string
          source?: Database["public"]["Enums"]["program_source"]
          status?: Database["public"]["Enums"]["program_status"]
          tldr?: string | null
          tuition_cents?: number | null
          type: Database["public"]["Enums"]["program_type"]
          updated_at?: string
          url?: string | null
          visa_sponsorship?: boolean | null
        }
        Update: {
          applicant_count?: number
          apply_url?: string | null
          best_for?: string | null
          brand_score?: number | null
          cash_value_usd?: number | null
          check_size_max?: number | null
          check_size_min?: number | null
          closes_at?: string | null
          cohort_name?: string | null
          cohort_size?: number | null
          cons?: string[] | null
          cost_to_apply_cents?: number | null
          created_at?: string
          credit_value_usd?: number | null
          deadline_at?: string | null
          degree_level?: string | null
          description?: string | null
          details?: Json
          details_schema_version?: number
          domain?: string
          employment_type?: string | null
          equity_pct?: number | null
          equity_taken?: number | null
          expected_reward_cents_max?: number | null
          expected_reward_cents_min?: number | null
          follow_on_rate_pct?: number | null
          funder_id?: string | null
          funder_type?: string | null
          funder_user_id?: string | null
          funding_amount_cents?: number | null
          geo_focus?: string[] | null
          gmat_required?: boolean | null
          gre_required?: boolean | null
          heat_score?: number
          id?: string
          industry_tags?: string[] | null
          is_rolling?: boolean
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          last_scraped_at?: string | null
          location_city?: string | null
          location_country?: string | null
          logo_url?: string | null
          match_required?: boolean | null
          name?: string
          network_score?: number | null
          opens_at?: string | null
          organization?: string
          parent_program_id?: string | null
          program_length_months?: number | null
          program_start_date?: string | null
          program_value_score?: number | null
          pros?: string[] | null
          remote_ok?: boolean | null
          results_at?: string | null
          round?: string | null
          salary_max_cents?: number | null
          salary_min_cents?: number | null
          scrape_url?: string | null
          seniority?: string | null
          slug?: string
          source?: Database["public"]["Enums"]["program_source"]
          status?: Database["public"]["Enums"]["program_status"]
          tldr?: string | null
          tuition_cents?: number | null
          type?: Database["public"]["Enums"]["program_type"]
          updated_at?: string
          url?: string | null
          visa_sponsorship?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_parent_program_id_fkey"
            columns: ["parent_program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_parent_program_id_fkey"
            columns: ["parent_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_alerts: {
        Row: {
          composite_score: number | null
          id: string
          program_id: string
          sent_at: string
          user_id: string
          week_bucket: string
        }
        Insert: {
          composite_score?: number | null
          id?: string
          program_id: string
          sent_at?: string
          user_id: string
          week_bucket?: string
        }
        Update: {
          composite_score?: number | null
          id?: string
          program_id?: string
          sent_at?: string
          user_id?: string
          week_bucket?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_alerts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_alerts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          error_text: string | null
          event_id: string
          event_type: string
          livemode: boolean
          processed_at: string | null
          received_at: string
        }
        Insert: {
          error_text?: string | null
          event_id: string
          event_type: string
          livemode: boolean
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          error_text?: string | null
          event_id?: string
          event_type?: string
          livemode?: boolean
          processed_at?: string | null
          received_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          ai_drafts_per_month: number
          can_export: boolean
          can_see_acceptance_rates: boolean
          can_see_heat_scores: boolean
          created_at: string
          id: string
          max_active_applications: number
          name: string
          price_annual_cents: number | null
          price_monthly_cents: number
          stripe_price_id_annual: string | null
          stripe_price_id_monthly: string | null
          stripe_product_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Insert: {
          ai_drafts_per_month?: number
          can_export?: boolean
          can_see_acceptance_rates?: boolean
          can_see_heat_scores?: boolean
          created_at?: string
          id?: string
          max_active_applications?: number
          name: string
          price_annual_cents?: number | null
          price_monthly_cents: number
          stripe_price_id_annual?: string | null
          stripe_price_id_monthly?: string | null
          stripe_product_id?: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Update: {
          ai_drafts_per_month?: number
          can_export?: boolean
          can_see_acceptance_rates?: boolean
          can_see_heat_scores?: boolean
          created_at?: string
          id?: string
          max_active_applications?: number
          name?: string
          price_annual_cents?: number | null
          price_monthly_cents?: number
          stripe_price_id_annual?: string | null
          stripe_price_id_monthly?: string | null
          stripe_product_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Relationships: []
      }
      team_answers: {
        Row: {
          archived_question_id: string
          confidence: string
          content: string
          created_at: string
          created_by: string
          id: string
          team_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_question_id: string
          confidence?: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          team_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_question_id?: string
          confidence?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          team_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_answers_archived_question_id_fkey"
            columns: ["archived_question_id"]
            isOneToOne: false
            referencedRelation: "archived_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_answers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          team_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          team_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          invited_at: string
          invited_by: string | null
          joined_at: string | null
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          plan: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          plan?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_applications: {
        Row: {
          completion_pct: number
          created_at: string
          id: string
          is_public_result: boolean
          notes: string | null
          program_id: string
          result_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completion_pct?: number
          created_at?: string
          id?: string
          is_public_result?: boolean
          notes?: string | null
          program_id: string
          result_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completion_pct?: number
          created_at?: string
          id?: string
          is_public_result?: boolean
          notes?: string | null
          program_id?: string
          result_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_applications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_applications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_applications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contributions: {
        Row: {
          awarded_at: string
          credit_amount: number
          credit_type: string
          id: string
          import_queue_id: string
          kind: Database["public"]["Enums"]["opportunity_kind"] | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          credit_amount?: number
          credit_type?: string
          id?: string
          import_queue_id: string
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          credit_amount?: number
          credit_type?: string
          id?: string
          import_queue_id?: string
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_contributions_import_queue_id_fkey"
            columns: ["import_queue_id"]
            isOneToOne: false
            referencedRelation: "import_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          base_url: string | null
          created_at: string
          id: string
          is_default: boolean
          key_encrypted: string | null
          key_fingerprint: string | null
          key_storage_ref: string | null
          label: string
          last_error: string | null
          last_verified_at: string | null
          model_preference: string | null
          provider: Database["public"]["Enums"]["ai_provider_type"]
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          key_encrypted?: string | null
          key_fingerprint?: string | null
          key_storage_ref?: string | null
          label?: string
          last_error?: string | null
          last_verified_at?: string | null
          model_preference?: string | null
          provider: Database["public"]["Enums"]["ai_provider_type"]
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          key_encrypted?: string | null
          key_fingerprint?: string | null
          key_storage_ref?: string | null
          label?: string
          last_error?: string | null
          last_verified_at?: string | null
          model_preference?: string | null
          provider?: Database["public"]["Enums"]["ai_provider_type"]
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          active_identity: Database["public"]["Enums"]["applicant_mode"]
          applicant_context: Json
          avatar_url: string | null
          bio: string | null
          company_name: string | null
          company_one_liner: string | null
          company_url: string | null
          created_at: string
          deadline_alerts_enabled: boolean
          display_name: string | null
          email_notifications: boolean
          founder_type: string | null
          github_url: string | null
          id: string
          identities: Database["public"]["Enums"]["applicant_mode"][]
          industry_tags: string[]
          is_technical_founder: boolean | null
          linkedin_url: string | null
          location_city: string | null
          location_country: string | null
          profile_visibility: string
          stage: string | null
          team_size: number | null
          twitter_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_identity?: Database["public"]["Enums"]["applicant_mode"]
          applicant_context?: Json
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          company_one_liner?: string | null
          company_url?: string | null
          created_at?: string
          deadline_alerts_enabled?: boolean
          display_name?: string | null
          email_notifications?: boolean
          founder_type?: string | null
          github_url?: string | null
          id?: string
          identities?: Database["public"]["Enums"]["applicant_mode"][]
          industry_tags?: string[]
          is_technical_founder?: boolean | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          profile_visibility?: string
          stage?: string | null
          team_size?: number | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_identity?: Database["public"]["Enums"]["applicant_mode"]
          applicant_context?: Json
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          company_one_liner?: string | null
          company_url?: string | null
          created_at?: string
          deadline_alerts_enabled?: boolean
          display_name?: string | null
          email_notifications?: boolean
          founder_type?: string | null
          github_url?: string | null
          id?: string
          identities?: Database["public"]["Enums"]["applicant_mode"][]
          industry_tags?: string[]
          is_technical_founder?: boolean | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          profile_visibility?: string
          stage?: string | null
          team_size?: number | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_program_fit: {
        Row: {
          computed_at: string
          coverage_pct: number | null
          criteria_match: number | null
          fit_score: number
          id: string
          program_id: string
          quality_signal: number | null
          theme_alignment: number | null
          user_id: string
        }
        Insert: {
          computed_at?: string
          coverage_pct?: number | null
          criteria_match?: number | null
          fit_score?: number
          id?: string
          program_id: string
          quality_signal?: number | null
          theme_alignment?: number | null
          user_id: string
        }
        Update: {
          computed_at?: string
          coverage_pct?: number | null
          criteria_match?: number | null
          fit_score?: number
          id?: string
          program_id?: string
          quality_signal?: number | null
          theme_alignment?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_program_fit_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_program_fit_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_question_unlocks: {
        Row: {
          archived_question_id: string
          id: string
          source: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          archived_question_id: string
          id?: string
          source?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          archived_question_id?: string
          id?: string
          source?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_question_unlocks_archived_question_id_fkey"
            columns: ["archived_question_id"]
            isOneToOne: false
            referencedRelation: "archived_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          monthly_draft_limit: number | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_draft_limit?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_draft_limit?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      opportunities: {
        Row: {
          applicant_count: number | null
          apply_url: string | null
          best_for: string | null
          brand_score: number | null
          cash_value_usd: number | null
          check_size_max: number | null
          check_size_min: number | null
          closes_at: string | null
          cohort_name: string | null
          cohort_size: number | null
          cons: string[] | null
          cost_to_apply_cents: number | null
          created_at: string | null
          credit_value_usd: number | null
          deadline_at: string | null
          degree_level: string | null
          description: string | null
          details: Json | null
          details_schema_version: number | null
          domain: string | null
          employment_type: string | null
          equity_pct: number | null
          equity_taken: number | null
          expected_reward_cents_max: number | null
          expected_reward_cents_min: number | null
          follow_on_rate_pct: number | null
          funder_id: string | null
          funder_type: string | null
          funder_user_id: string | null
          funding_amount_cents: number | null
          geo_focus: string[] | null
          gmat_required: boolean | null
          gre_required: boolean | null
          heat_score: number | null
          id: string | null
          industry_tags: string[] | null
          is_rolling: boolean | null
          kind: Database["public"]["Enums"]["opportunity_kind"] | null
          last_scraped_at: string | null
          location_city: string | null
          location_country: string | null
          logo_url: string | null
          match_required: boolean | null
          name: string | null
          network_score: number | null
          opens_at: string | null
          organization: string | null
          parent_program_id: string | null
          program_length_months: number | null
          program_start_date: string | null
          program_value_score: number | null
          pros: string[] | null
          remote_ok: boolean | null
          results_at: string | null
          round: string | null
          salary_max_cents: number | null
          salary_min_cents: number | null
          scrape_url: string | null
          seniority: string | null
          slug: string | null
          source: Database["public"]["Enums"]["program_source"] | null
          status: Database["public"]["Enums"]["program_status"] | null
          tldr: string | null
          tuition_cents: number | null
          type: Database["public"]["Enums"]["program_type"] | null
          updated_at: string | null
          url: string | null
          visa_sponsorship: boolean | null
        }
        Insert: {
          applicant_count?: number | null
          apply_url?: string | null
          best_for?: string | null
          brand_score?: number | null
          cash_value_usd?: number | null
          check_size_max?: number | null
          check_size_min?: number | null
          closes_at?: string | null
          cohort_name?: string | null
          cohort_size?: number | null
          cons?: string[] | null
          cost_to_apply_cents?: number | null
          created_at?: string | null
          credit_value_usd?: number | null
          deadline_at?: string | null
          degree_level?: string | null
          description?: string | null
          details?: Json | null
          details_schema_version?: number | null
          domain?: string | null
          employment_type?: string | null
          equity_pct?: number | null
          equity_taken?: number | null
          expected_reward_cents_max?: number | null
          expected_reward_cents_min?: number | null
          follow_on_rate_pct?: number | null
          funder_id?: string | null
          funder_type?: string | null
          funder_user_id?: string | null
          funding_amount_cents?: number | null
          geo_focus?: string[] | null
          gmat_required?: boolean | null
          gre_required?: boolean | null
          heat_score?: number | null
          id?: string | null
          industry_tags?: string[] | null
          is_rolling?: boolean | null
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          last_scraped_at?: string | null
          location_city?: string | null
          location_country?: string | null
          logo_url?: string | null
          match_required?: boolean | null
          name?: string | null
          network_score?: number | null
          opens_at?: string | null
          organization?: string | null
          parent_program_id?: string | null
          program_length_months?: number | null
          program_start_date?: string | null
          program_value_score?: number | null
          pros?: string[] | null
          remote_ok?: boolean | null
          results_at?: string | null
          round?: string | null
          salary_max_cents?: number | null
          salary_min_cents?: number | null
          scrape_url?: string | null
          seniority?: string | null
          slug?: string | null
          source?: Database["public"]["Enums"]["program_source"] | null
          status?: Database["public"]["Enums"]["program_status"] | null
          tldr?: string | null
          tuition_cents?: number | null
          type?: Database["public"]["Enums"]["program_type"] | null
          updated_at?: string | null
          url?: string | null
          visa_sponsorship?: boolean | null
        }
        Update: {
          applicant_count?: number | null
          apply_url?: string | null
          best_for?: string | null
          brand_score?: number | null
          cash_value_usd?: number | null
          check_size_max?: number | null
          check_size_min?: number | null
          closes_at?: string | null
          cohort_name?: string | null
          cohort_size?: number | null
          cons?: string[] | null
          cost_to_apply_cents?: number | null
          created_at?: string | null
          credit_value_usd?: number | null
          deadline_at?: string | null
          degree_level?: string | null
          description?: string | null
          details?: Json | null
          details_schema_version?: number | null
          domain?: string | null
          employment_type?: string | null
          equity_pct?: number | null
          equity_taken?: number | null
          expected_reward_cents_max?: number | null
          expected_reward_cents_min?: number | null
          follow_on_rate_pct?: number | null
          funder_id?: string | null
          funder_type?: string | null
          funder_user_id?: string | null
          funding_amount_cents?: number | null
          geo_focus?: string[] | null
          gmat_required?: boolean | null
          gre_required?: boolean | null
          heat_score?: number | null
          id?: string | null
          industry_tags?: string[] | null
          is_rolling?: boolean | null
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          last_scraped_at?: string | null
          location_city?: string | null
          location_country?: string | null
          logo_url?: string | null
          match_required?: boolean | null
          name?: string | null
          network_score?: number | null
          opens_at?: string | null
          organization?: string | null
          parent_program_id?: string | null
          program_length_months?: number | null
          program_start_date?: string | null
          program_value_score?: number | null
          pros?: string[] | null
          remote_ok?: boolean | null
          results_at?: string | null
          round?: string | null
          salary_max_cents?: number | null
          salary_min_cents?: number | null
          scrape_url?: string | null
          seniority?: string | null
          slug?: string | null
          source?: Database["public"]["Enums"]["program_source"] | null
          status?: Database["public"]["Enums"]["program_status"] | null
          tldr?: string | null
          tuition_cents?: number | null
          type?: Database["public"]["Enums"]["program_type"] | null
          updated_at?: string | null
          url?: string | null
          visa_sponsorship?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_parent_program_id_fkey"
            columns: ["parent_program_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_parent_program_id_fkey"
            columns: ["parent_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contribution_summary: {
        Row: {
          contribution_count: number | null
          last_awarded_at: string | null
          total_credits_earned: number | null
          user_id: string | null
        }
        Relationships: []
      }
      user_credit_balance: {
        Row: {
          balance: number | null
          event_count: number | null
          last_earned_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_update_program_status: { Args: never; Returns: undefined }
      compute_program_dna: { Args: never; Returns: undefined }
      compute_significance_scores: { Args: never; Returns: undefined }
      compute_user_fit_scores: {
        Args: { p_user_id?: string }
        Returns: undefined
      }
      increment_draft_count: {
        Args: { p_month_year: string; p_user_id: string }
        Returns: undefined
      }
      match_archived_questions: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          asked_by_count: number
          id: string
          is_universal: boolean
          significance_score: number
          similarity: number
          text: string
          theme: string
        }[]
      }
      recompute_all_heat_scores: { Args: never; Returns: undefined }
      run_daily_drip: {
        Args: { p_user_id: string }
        Returns: {
          question_id: string
          question_text: string
          significance: number
          theme: string
        }[]
      }
      seed_signup_questions: { Args: { p_user_id: string }; Returns: number }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      ai_provider_type: "anthropic" | "openai" | "google" | "ollama" | "custom"
      answer_confidence: "draft" | "solid" | "locked"
      answer_stress_depth: "light" | "medium" | "deep"
      applicant_mode: "founder" | "job_seeker" | "student" | "researcher"
      application_status:
        | "saved"
        | "drafting"
        | "submitted"
        | "accepted"
        | "rejected"
        | "waitlist"
      import_status:
        | "pending"
        | "mapped"
        | "rejected"
        | "manual"
        | "pending_review"
        | "accepted"
        | "processed"
      integration_status: "pending" | "active" | "invalid" | "disabled"
      integration_type: "claude" | "openai" | "custom_agent" | "mcp" | "webhook"
      listing_status: "pending_payment" | "active" | "expired" | "canceled"
      listing_tier: "standard" | "verified" | "featured"
      opportunity_kind:
        | "accelerator"
        | "vc"
        | "grant"
        | "fellowship"
        | "job_fulltime"
        | "job_internship"
        | "job_contract"
        | "school_undergrad"
        | "school_grad"
        | "school_professional"
        | "other"
      outcome_type: "accepted" | "rejected" | "waitlist"
      program_source: "seeded" | "community" | "funder"
      program_status: "upcoming" | "open" | "closed" | "results"
      program_type:
        | "grant"
        | "accel"
        | "vc"
        | "corp"
        | "uni"
        | "job"
        | "fellowship"
        | "other"
      response_type:
        | "text_short"
        | "text_long"
        | "multiple_choice"
        | "yes_no"
        | "number"
        | "url"
        | "file_upload"
        | "date"
      signal_type: "view" | "save" | "start" | "submit"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "paused"
      subscription_tier: "free" | "pro" | "team"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ai_provider_type: ["anthropic", "openai", "google", "ollama", "custom"],
      answer_confidence: ["draft", "solid", "locked"],
      answer_stress_depth: ["light", "medium", "deep"],
      applicant_mode: ["founder", "job_seeker", "student", "researcher"],
      application_status: [
        "saved",
        "drafting",
        "submitted",
        "accepted",
        "rejected",
        "waitlist",
      ],
      import_status: [
        "pending",
        "mapped",
        "rejected",
        "manual",
        "pending_review",
        "accepted",
        "processed",
      ],
      integration_status: ["pending", "active", "invalid", "disabled"],
      integration_type: ["claude", "openai", "custom_agent", "mcp", "webhook"],
      listing_status: ["pending_payment", "active", "expired", "canceled"],
      listing_tier: ["standard", "verified", "featured"],
      opportunity_kind: [
        "accelerator",
        "vc",
        "grant",
        "fellowship",
        "job_fulltime",
        "job_internship",
        "job_contract",
        "school_undergrad",
        "school_grad",
        "school_professional",
        "other",
      ],
      outcome_type: ["accepted", "rejected", "waitlist"],
      program_source: ["seeded", "community", "funder"],
      program_status: ["upcoming", "open", "closed", "results"],
      program_type: [
        "grant",
        "accel",
        "vc",
        "corp",
        "uni",
        "job",
        "fellowship",
        "other",
      ],
      response_type: [
        "text_short",
        "text_long",
        "multiple_choice",
        "yes_no",
        "number",
        "url",
        "file_upload",
        "date",
      ],
      signal_type: ["view", "save", "start", "submit"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "paused",
      ],
      subscription_tier: ["free", "pro", "team"],
    },
  },
} as const

// ── Convenience row aliases ───────────────────────────────────────────────────
type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

type View<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"]

export type Program                  = Row<"programs">
export type ProfileAnswer            = Row<"profile_answers">
export type UserApplication          = Row<"user_applications">
export type UserProgramFit           = Row<"user_program_fit">
export type ProgramDna               = Row<"program_dna">
export type ArchivedQuestion         = Row<"archived_questions">
export type UserContributionSummary  = View<"user_contribution_summary">
export type ProfileAnswerWithQuestion = Row<"profile_answers"> & {
  archived_question: Row<"archived_questions"> | null
}
export type ProgramQuestionWithArchived = Row<"program_questions"> & {
  archived_question: Row<"archived_questions"> | null
}
export interface ProgramNextCycle {
  program_id: string
  cycle_id: string
  cycle_name: string
  opens_at: string | null
  closes_at: string | null
  cohort_name: string | null
  cohort_size: number | null
  apply_url: string | null
}

export type ProgramWithFit = Program & {
  fit?: UserProgramFit | null
  application?: Row<"user_applications"> | null
  cycle?: ProgramNextCycle | null
}

// ── Enum aliases ──────────────────────────────────────────────────────────────
export type ApplicantMode      = Database["public"]["Enums"]["applicant_mode"]
export type SubscriptionTier   = Database["public"]["Enums"]["subscription_tier"]
export type AnswerConfidence   = Database["public"]["Enums"]["answer_confidence"]
export type QuestionTheme = 'traction' | 'team' | 'vision' | 'market' | 'product' | 'financials' | 'impact' | 'legal' | 'other' | 'problem' | 'solution' | 'business_model' | 'technical' | 'fundraising' | 'personal' | 'fit'
