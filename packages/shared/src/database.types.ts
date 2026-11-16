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
    PostgrestVersion: "14.1"
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
      activity_log: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          type: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          type: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_items: {
        Row: {
          allocation_id: string
          id: string
          product_id: string
          retail_quantity: number
          wholesale_quantity: number
        }
        Insert: {
          allocation_id: string
          id?: string
          product_id: string
          retail_quantity?: number
          wholesale_quantity?: number
        }
        Update: {
          allocation_id?: string
          id?: string
          product_id?: string
          retail_quantity?: number
          wholesale_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "allocation_items_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      allocations: {
        Row: {
          allocated_by: string
          company_id: string
          completed_at: string | null
          created_at: string | null
          from_warehouse: boolean | null
          id: string
          notes: string | null
          sales_type: string
          status: string | null
          to_branch_id: string
        }
        Insert: {
          allocated_by: string
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          from_warehouse?: boolean | null
          id?: string
          notes?: string | null
          sales_type: string
          status?: string | null
          to_branch_id: string
        }
        Update: {
          allocated_by?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          from_warehouse?: boolean | null
          id?: string
          notes?: string | null
          sales_type?: string
          status?: string | null
          to_branch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_allocated_by_fkey"
            columns: ["allocated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_inventory: {
        Row: {
          branch_id: string
          company_id: string | null
          low_stock: boolean | null
          product_id: string
          quantity: number
          retail_quantity: number | null
          updated_at: string | null
          wholesale_quantity: number | null
        }
        Insert: {
          branch_id: string
          company_id?: string | null
          low_stock?: boolean | null
          product_id: string
          quantity?: number
          retail_quantity?: number | null
          updated_at?: string | null
          wholesale_quantity?: number | null
        }
        Update: {
          branch_id?: string
          company_id?: string | null
          low_stock?: boolean | null
          product_id?: string
          quantity?: number
          retail_quantity?: number | null
          updated_at?: string | null
          wholesale_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_staff: {
        Row: {
          branch_id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          user_id: string
        }
        Update: {
          branch_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          name: string
          sales_type: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          sales_type?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sales_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      central_inventory: {
        Row: {
          company_id: string | null
          product_id: string
          quantity: number
        }
        Insert: {
          company_id?: string | null
          product_id: string
          quantity?: number
        }
        Update: {
          company_id?: string | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "central_inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "central_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          id: string
          location: string | null
          name: string
          phone: string | null
          plan: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location?: string | null
          name: string
          phone?: string | null
          plan?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location?: string | null
          name?: string
          phone?: string | null
          plan?: string | null
          status?: string | null
        }
        Relationships: []
      }
      edge_function_registry: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          name?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string | null
          delivered_quantity: number | null
          id: string
          invoice_id: string | null
          notes: string | null
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          delivered_quantity?: number | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          delivered_quantity?: number | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          product_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          approved_by: string | null
          branch_id: string
          company_id: string
          created_at: string | null
          delivered_at: string | null
          generated_at: string | null
          id: string
          invoice_number: string
          requested_by: string | null
          restock_request_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          branch_id: string
          company_id: string
          created_at?: string | null
          delivered_at?: string | null
          generated_at?: string | null
          id?: string
          invoice_number: string
          requested_by?: string | null
          restock_request_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          branch_id?: string
          company_id?: string
          created_at?: string | null
          delivered_at?: string | null
          generated_at?: string | null
          id?: string
          invoice_number?: string
          requested_by?: string | null
          restock_request_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_restock_request_id_fkey"
            columns: ["restock_request_id"]
            isOneToOne: false
            referencedRelation: "restock_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_restock_request_id_fkey"
            columns: ["restock_request_id"]
            isOneToOne: false
            referencedRelation: "view_completed_restock_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_restock_request_id_fkey"
            columns: ["restock_request_id"]
            isOneToOne: false
            referencedRelation: "view_pending_restock_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payrolls: {
        Row: {
          commission: number | null
          id: string
          month: string | null
          paid: boolean | null
          total_pay: number | null
          total_sales: number | null
          user_id: string | null
        }
        Insert: {
          commission?: number | null
          id?: string
          month?: string | null
          paid?: boolean | null
          total_pay?: number | null
          total_sales?: number | null
          user_id?: string | null
        }
        Update: {
          commission?: number | null
          id?: string
          month?: string | null
          paid?: boolean | null
          total_pay?: number | null
          total_sales?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payrolls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          change_type: string | null
          changed_at: string | null
          changed_by: string | null
          company_id: string
          id: string
          new_price: number
          old_price: number
          product_id: string
          quantity_at_change: number | null
        }
        Insert: {
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          company_id: string
          id?: string
          new_price: number
          old_price: number
          product_id: string
          quantity_at_change?: number | null
        }
        Update: {
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          company_id?: string
          id?: string
          new_price?: number
          old_price?: number
          product_id?: string
          quantity_at_change?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string | null
          id: string
          low_stock_threshold: number | null
          name: string
          price: number
          sku: string | null
          wholesale_price: number | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          low_stock_threshold?: number | null
          name: string
          price: number
          sku?: string | null
          wholesale_price?: number | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          low_stock_threshold?: number | null
          name?: string
          price?: number
          sku?: string | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_invoice_items: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          product_id: string | null
          quantity_delivered: number
          quantity_requested: number
          restock_request_id: string | null
          total_price: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity_delivered: number
          quantity_requested: number
          restock_request_id?: string | null
          total_price: number
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity_delivered?: number
          quantity_requested?: number
          restock_request_id?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_invoice_items_restock_request_id_fkey"
            columns: ["restock_request_id"]
            isOneToOne: false
            referencedRelation: "restock_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_invoice_items_restock_request_id_fkey"
            columns: ["restock_request_id"]
            isOneToOne: false
            referencedRelation: "view_completed_restock_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_invoice_items_restock_request_id_fkey"
            columns: ["restock_request_id"]
            isOneToOne: false
            referencedRelation: "view_pending_restock_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_invoices: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          delivered_by: string | null
          delivery_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          restock_request_id: string | null
          status: string | null
          total_amount: number
          total_items: number
          total_quantity: number
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_by?: string | null
          delivery_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          restock_request_id?: string | null
          status?: string | null
          total_amount: number
          total_items: number
          total_quantity: number
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_by?: string | null
          delivery_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          restock_request_id?: string | null
          status?: string | null
          total_amount?: number
          total_items?: number
          total_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "restock_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_invoices_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_invoices_restock_request_id_fkey"
            columns: ["restock_request_id"]
            isOneToOne: false
            referencedRelation: "restock_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_invoices_restock_request_id_fkey"
            columns: ["restock_request_id"]
            isOneToOne: false
            referencedRelation: "view_completed_restock_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_invoices_restock_request_id_fkey"
            columns: ["restock_request_id"]
            isOneToOne: false
            referencedRelation: "view_pending_restock_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_requests: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          company_id: string | null
          created_at: string | null
          delivered_by: string | null
          delivery_date: string | null
          delivery_status: string | null
          fulfilled_at: string | null
          fulfilled_quantity: number | null
          id: string
          invoice_id: string | null
          invoice_number: string | null
          items: Json | null
          notes: string | null
          product_id: string | null
          rejected_at: string | null
          requested_by: string | null
          requested_quantity: number
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          delivered_by?: string | null
          delivery_date?: string | null
          delivery_status?: string | null
          fulfilled_at?: string | null
          fulfilled_quantity?: number | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          items?: Json | null
          notes?: string | null
          product_id?: string | null
          rejected_at?: string | null
          requested_by?: string | null
          requested_quantity: number
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          delivered_by?: string | null
          delivery_date?: string | null
          delivery_status?: string | null
          fulfilled_at?: string | null
          fulfilled_quantity?: number | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          items?: Json | null
          notes?: string | null
          product_id?: string | null
          rejected_at?: string | null
          requested_by?: string | null
          requested_quantity?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_requests_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_requests_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          id: string
          price: number
          product_id: string | null
          quantity: number
          refund_amount: number
          restocked: boolean | null
          restocked_at: string | null
          return_id: string | null
          sales_type: string | null
        }
        Insert: {
          id?: string
          price: number
          product_id?: string | null
          quantity: number
          refund_amount: number
          restocked?: boolean | null
          restocked_at?: string | null
          return_id?: string | null
          sales_type?: string | null
        }
        Update: {
          id?: string
          price?: number
          product_id?: string | null
          quantity?: number
          refund_amount?: number
          restocked?: boolean | null
          restocked_at?: string | null
          return_id?: string | null
          sales_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string | null
          id: string
          original_sale_date: string | null
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          sale_id: string | null
          sales_type: string | null
          salesperson_id: string | null
          status: string | null
          total_refund: number
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          original_sale_date?: string | null
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sale_id?: string | null
          sales_type?: string | null
          salesperson_id?: string | null
          status?: string | null
          total_refund: number
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          original_sale_date?: string | null
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sale_id?: string | null
          sales_type?: string | null
          salesperson_id?: string | null
          status?: string | null
          total_refund?: number
        }
        Relationships: [
          {
            foreignKeyName: "returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      salaries: {
        Row: {
          base_salary: number | null
          commission_rate: number | null
          user_id: string
        }
        Insert: {
          base_salary?: number | null
          commission_rate?: number | null
          user_id: string
        }
        Update: {
          base_salary?: number | null
          commission_rate?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          original_price: number | null
          price: number
          product_id: string | null
          quantity: number
          sale_id: string | null
          sales_type: string | null
          wholesale_price: number | null
        }
        Insert: {
          id?: string
          original_price?: number | null
          price: number
          product_id?: string | null
          quantity: number
          sale_id?: string | null
          sales_type?: string | null
          wholesale_price?: number | null
        }
        Update: {
          id?: string
          original_price?: number | null
          price?: number
          product_id?: string | null
          quantity?: number
          sale_id?: string | null
          sales_type?: string | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string | null
          change_given: number | null
          company_id: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_notes: string | null
          payment_received: number | null
          refunded_amount: number | null
          return_id: string | null
          return_status: string | null
          sales_type: string | null
          salesperson_id: string | null
          total: number
        }
        Insert: {
          branch_id?: string | null
          change_given?: number | null
          company_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_notes?: string | null
          payment_received?: number | null
          refunded_amount?: number | null
          return_id?: string | null
          return_status?: string | null
          sales_type?: string | null
          salesperson_id?: string | null
          total: number
        }
        Update: {
          branch_id?: string | null
          change_given?: number | null
          company_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_notes?: string | null
          payment_received?: number | null
          refunded_amount?: number | null
          return_id?: string | null
          return_status?: string | null
          sales_type?: string | null
          salesperson_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_features: {
        Row: {
          enabled: boolean | null
          feature: string
          plan: string
        }
        Insert: {
          enabled?: boolean | null
          feature: string
          plan: string
        }
        Update: {
          enabled?: boolean | null
          feature?: string
          plan?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          company_id: string | null
          expires_at: string | null
          id: string
          plan: string
          started_at: string | null
          status: string
        }
        Insert: {
          company_id?: string | null
          expires_at?: string | null
          id?: string
          plan: string
          started_at?: string | null
          status: string
        }
        Update: {
          company_id?: string | null
          expires_at?: string | null
          id?: string
          plan?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_logs: {
        Row: {
          action_type: string
          amount: number | null
          branch_id: string | null
          company_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          reference_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          amount?: number | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          reference_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          amount?: number | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          reference_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string
          sales_type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role: string
          sales_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          sales_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_inventory: {
        Row: {
          batch_lot_number: string | null
          boxes_received: number | null
          company_id: string
          cost_per_box: number | null
          cost_per_unit: number | null
          created_at: string | null
          date_received: string | null
          id: string
          last_restocked_at: string | null
          low_stock: boolean | null
          min_stock_level: number | null
          notes: string | null
          product_id: string
          quantity: number
          supplier_name: string | null
          units_per_box: number | null
          updated_at: string | null
          warehouse_location: string | null
        }
        Insert: {
          batch_lot_number?: string | null
          boxes_received?: number | null
          company_id: string
          cost_per_box?: number | null
          cost_per_unit?: number | null
          created_at?: string | null
          date_received?: string | null
          id?: string
          last_restocked_at?: string | null
          low_stock?: boolean | null
          min_stock_level?: number | null
          notes?: string | null
          product_id: string
          quantity?: number
          supplier_name?: string | null
          units_per_box?: number | null
          updated_at?: string | null
          warehouse_location?: string | null
        }
        Update: {
          batch_lot_number?: string | null
          boxes_received?: number | null
          company_id?: string
          cost_per_box?: number | null
          cost_per_unit?: number | null
          created_at?: string | null
          date_received?: string | null
          id?: string
          last_restocked_at?: string | null
          low_stock?: boolean | null
          min_stock_level?: number | null
          notes?: string | null
          product_id?: string
          quantity?: number
          supplier_name?: string | null
          units_per_box?: number | null
          updated_at?: string | null
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      branch_inventory_with_low_stock: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          company_id: string | null
          is_low_stock: boolean | null
          low_stock: boolean | null
          low_stock_threshold: number | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          retail_quantity: number | null
          updated_at: string | null
          wholesale_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      view_completed_restock_requests: {
        Row: {
          admin_notes: string | null
          branch_id: string | null
          company_id: string | null
          created_at: string | null
          id: string | null
          items: Json | null
          product_id: string | null
          requested_by: string | null
          requested_quantity: number | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          items?: Json | null
          product_id?: string | null
          requested_by?: string | null
          requested_quantity?: number | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          items?: Json | null
          product_id?: string | null
          requested_by?: string | null
          requested_quantity?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      view_pending_restock_requests: {
        Row: {
          admin_notes: string | null
          branch_id: string | null
          company_id: string | null
          created_at: string | null
          id: string | null
          items: Json | null
          product_id: string | null
          requested_by: string | null
          requested_quantity: number | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          items?: Json | null
          product_id?: string | null
          requested_by?: string | null
          requested_quantity?: number | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          items?: Json | null
          product_id?: string | null
          requested_by?: string | null
          requested_quantity?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_user_company_access: {
        Args: { user_company_id: string }
        Returns: boolean
      }
      current_user_company_id: { Args: never; Returns: string }
      get_user_company: { Args: { uid: string }; Returns: string }
      increment_warehouse_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      process_allocation: {
        Args: {
          p_allocation_id: string
          p_company_id: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      payment_method_enum: "cash" | "mobile_money" | "card" | "split"
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
      payment_method_enum: ["cash", "mobile_money", "card", "split"],
    },
  },
} as const
