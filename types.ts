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
      audiencias: {
        Row: {
          created_at: string
          data_hora: string
          id: string
          link: string | null
          local: string | null
          magistrado_nome: string | null
          modalidade: Database["public"]["Enums"]["audiencia_modalidade"]
          observacoes: string | null
          processo_id: string
          status: Database["public"]["Enums"]["audiencia_status"]
          updated_at: string
          vara: string | null
        }
        Insert: {
          created_at?: string
          data_hora: string
          id?: string
          link?: string | null
          local?: string | null
          magistrado_nome?: string | null
          modalidade?: Database["public"]["Enums"]["audiencia_modalidade"]
          observacoes?: string | null
          processo_id: string
          status?: Database["public"]["Enums"]["audiencia_status"]
          updated_at?: string
          vara?: string | null
        }
        Update: {
          created_at?: string
          data_hora?: string
          id?: string
          link?: string | null
          local?: string | null
          magistrado_nome?: string | null
          modalidade?: Database["public"]["Enums"]["audiencia_modalidade"]
          observacoes?: string | null
          processo_id?: string
          status?: Database["public"]["Enums"]["audiencia_status"]
          updated_at?: string
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      bnmp_mandados: {
        Row: {
          created_at: string
          cumprido_em: string | null
          documento_id: string | null
          expedido_em: string
          id: string
          numero_mandado: string | null
          parte_documento: string | null
          parte_id: string | null
          parte_nome: string
          processo_id: string
          status: string
          subtipo: string
        }
        Insert: {
          created_at?: string
          cumprido_em?: string | null
          documento_id?: string | null
          expedido_em?: string
          id?: string
          numero_mandado?: string | null
          parte_documento?: string | null
          parte_id?: string | null
          parte_nome: string
          processo_id: string
          status?: string
          subtipo?: string
        }
        Update: {
          created_at?: string
          cumprido_em?: string | null
          documento_id?: string | null
          expedido_em?: string
          id?: string
          numero_mandado?: string | null
          parte_documento?: string | null
          parte_id?: string | null
          parte_nome?: string
          processo_id?: string
          status?: string
          subtipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "bnmp_mandados_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_processo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bnmp_mandados_parte_id_fkey"
            columns: ["parte_id"]
            isOneToOne: false
            referencedRelation: "partes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bnmp_mandados_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      comarcas: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          uf: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          uf: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          uf?: string
        }
        Relationships: []
      }
      documentos_processo: {
        Row: {
          arquivo_url: string | null
          autor_cargo: string | null
          autor_id: string | null
          autor_nome: string | null
          conteudo_html: string | null
          created_at: string
          id: string
          metadata: Json
          processo_id: string
          publicado_dje: boolean
          publico: boolean
          tipo: Database["public"]["Enums"]["tipo_documento"]
          titulo: string
        }
        Insert: {
          arquivo_url?: string | null
          autor_cargo?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          conteudo_html?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          processo_id: string
          publicado_dje?: boolean
          publico?: boolean
          tipo: Database["public"]["Enums"]["tipo_documento"]
          titulo: string
        }
        Update: {
          arquivo_url?: string | null
          autor_cargo?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          conteudo_html?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          processo_id?: string
          publicado_dje?: boolean
          publico?: boolean
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_processo_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      habilitacoes: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          documentos: Json
          historico: Json
          id: string
          justificativa: string | null
          numero_processo: string | null
          processo_id: string | null
          solicitante_id: string
          status: Database["public"]["Enums"]["habilitacao_status"]
          tipo: string
          updated_at: string
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          documentos?: Json
          historico?: Json
          id?: string
          justificativa?: string | null
          numero_processo?: string | null
          processo_id?: string | null
          solicitante_id: string
          status?: Database["public"]["Enums"]["habilitacao_status"]
          tipo: string
          updated_at?: string
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          documentos?: Json
          historico?: Json
          id?: string
          justificativa?: string | null
          numero_processo?: string | null
          processo_id?: string | null
          solicitante_id?: string
          status?: Database["public"]["Enums"]["habilitacao_status"]
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "habilitacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habilitacoes_solicitante_profile_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes: {
        Row: {
          autor_cargo: string | null
          autor_id: string | null
          autor_nome: string | null
          conteudo: string | null
          created_at: string
          data_movimentacao: string
          descricao: string
          id: string
          id_movimento: number | null
          processo_id: string
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
        }
        Insert: {
          autor_cargo?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          conteudo?: string | null
          created_at?: string
          data_movimentacao?: string
          descricao: string
          id?: string
          id_movimento?: number | null
          processo_id: string
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
        }
        Update: {
          autor_cargo?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          conteudo?: string | null
          created_at?: string
          data_movimentacao?: string
          descricao?: string
          id?: string
          id_movimento?: number | null
          processo_id?: string
          tipo?: Database["public"]["Enums"]["tipo_movimentacao"]
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      orgaos_julgadores: {
        Row: {
          ativo: boolean
          comarca: string
          created_at: string
          id: string
          nome: string
          segmento: string
          uf: string
        }
        Insert: {
          ativo?: boolean
          comarca: string
          created_at?: string
          id?: string
          nome: string
          segmento?: string
          uf: string
        }
        Update: {
          ativo?: boolean
          comarca?: string
          created_at?: string
          id?: string
          nome?: string
          segmento?: string
          uf?: string
        }
        Relationships: []
      }
      partes: {
        Row: {
          advogado_cpf: string | null
          advogado_nome: string | null
          advogado_oab: string | null
          created_at: string
          documento: string | null
          id: string
          nome: string
          processo_id: string
          representa_parte_id: string | null
          tipo: Database["public"]["Enums"]["tipo_parte"]
          user_id: string | null
        }
        Insert: {
          advogado_cpf?: string | null
          advogado_nome?: string | null
          advogado_oab?: string | null
          created_at?: string
          documento?: string | null
          id?: string
          nome: string
          processo_id: string
          representa_parte_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_parte"]
          user_id?: string | null
        }
        Update: {
          advogado_cpf?: string | null
          advogado_nome?: string | null
          advogado_oab?: string | null
          created_at?: string
          documento?: string | null
          id?: string
          nome?: string
          processo_id?: string
          representa_parte_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_parte"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partes_representa_parte_id_fkey"
            columns: ["representa_parte_id"]
            isOneToOne: false
            referencedRelation: "partes"
            referencedColumns: ["id"]
          },
        ]
      }
      prazos: {
        Row: {
          ato_processual: string | null
          created_at: string
          criado_por: string | null
          cumprido: boolean
          cumprido_em: string | null
          descricao: string | null
          destinatario_tipo: string
          destinatario_user_id: string | null
          dias: number | null
          id: string
          inicio_em: string
          lancado_automatico: boolean
          parte_nome: string
          parte_representada: string | null
          processo_id: string
          status: string
          vence_em: string
        }
        Insert: {
          ato_processual?: string | null
          created_at?: string
          criado_por?: string | null
          cumprido?: boolean
          cumprido_em?: string | null
          descricao?: string | null
          destinatario_tipo?: string
          destinatario_user_id?: string | null
          dias?: number | null
          id?: string
          inicio_em?: string
          lancado_automatico?: boolean
          parte_nome: string
          parte_representada?: string | null
          processo_id: string
          status?: string
          vence_em: string
        }
        Update: {
          ato_processual?: string | null
          created_at?: string
          criado_por?: string | null
          cumprido?: boolean
          cumprido_em?: string | null
          descricao?: string | null
          destinatario_tipo?: string
          destinatario_user_id?: string | null
          dias?: number | null
          id?: string
          inicio_em?: string
          lancado_automatico?: boolean
          parte_nome?: string
          parte_representada?: string | null
          processo_id?: string
          status?: string
          vence_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "prazos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          assunto: string
          classe: string
          comarca: string | null
          comprovante_url: string | null
          conclusao_em: string | null
          created_at: string
          criado_por: string | null
          data_distribuicao: string
          estado_uf: string | null
          fila_atual: Database["public"]["Enums"]["fila_conclusao"] | null
          fila_servidor: Database["public"]["Enums"]["fila_servidor"] | null
          id: string
          instancia: number
          is_rascunho: boolean
          justica_gratuita: boolean
          magistrado_id: string | null
          materia: string
          numero: string | null
          orgao_julgador: string | null
          percentual_preenchimento: number
          prioridade: boolean
          segredo_justica: boolean
          status: Database["public"]["Enums"]["processo_status"]
          updated_at: string
          valor_causa: number | null
          vara: string | null
        }
        Insert: {
          assunto: string
          classe: string
          comarca?: string | null
          comprovante_url?: string | null
          conclusao_em?: string | null
          created_at?: string
          criado_por?: string | null
          data_distribuicao?: string
          estado_uf?: string | null
          fila_atual?: Database["public"]["Enums"]["fila_conclusao"] | null
          fila_servidor?: Database["public"]["Enums"]["fila_servidor"] | null
          id?: string
          instancia?: number
          is_rascunho?: boolean
          justica_gratuita?: boolean
          magistrado_id?: string | null
          materia?: string
          numero?: string | null
          orgao_julgador?: string | null
          percentual_preenchimento?: number
          prioridade?: boolean
          segredo_justica?: boolean
          status?: Database["public"]["Enums"]["processo_status"]
          updated_at?: string
          valor_causa?: number | null
          vara?: string | null
        }
        Update: {
          assunto?: string
          classe?: string
          comarca?: string | null
          comprovante_url?: string | null
          conclusao_em?: string | null
          created_at?: string
          criado_por?: string | null
          data_distribuicao?: string
          estado_uf?: string | null
          fila_atual?: Database["public"]["Enums"]["fila_conclusao"] | null
          fila_servidor?: Database["public"]["Enums"]["fila_servidor"] | null
          id?: string
          instancia?: number
          is_rascunho?: boolean
          justica_gratuita?: boolean
          magistrado_id?: string | null
          materia?: string
          numero?: string | null
          orgao_julgador?: string | null
          percentual_preenchimento?: number
          prioridade?: boolean
          segredo_justica?: boolean
          status?: Database["public"]["Enums"]["processo_status"]
          updated_at?: string
          valor_causa?: number | null
          vara?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          comarca: string | null
          cpf: string | null
          created_at: string
          email_contato: string | null
          id: string
          materia: string | null
          nome_completo: string
          numero_usuario: string | null
          oab: string | null
          orgao: string | null
          uf: string | null
          updated_at: string
          username: string | null
          vara: string | null
        }
        Insert: {
          comarca?: string | null
          cpf?: string | null
          created_at?: string
          email_contato?: string | null
          id: string
          materia?: string | null
          nome_completo: string
          numero_usuario?: string | null
          oab?: string | null
          orgao?: string | null
          uf?: string | null
          updated_at?: string
          username?: string | null
          vara?: string | null
        }
        Update: {
          comarca?: string | null
          cpf?: string | null
          created_at?: string
          email_contato?: string | null
          id?: string
          materia?: string | null
          nome_completo?: string
          numero_usuario?: string | null
          oab?: string | null
          orgao?: string | null
          uf?: string | null
          updated_at?: string
          username?: string | null
          vara?: string | null
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      distribuir_processo: { Args: { _processo_id: string }; Returns: string }
      gen_cnj_numero: { Args: { _uf: string }; Returns: string }
      gen_numero_usuario: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_criador_processo: {
        Args: { _processo_id: string; _user_id: string }
        Returns: boolean
      }
      is_parte_do_processo: {
        Args: { _processo_id: string; _user_id: string }
        Returns: boolean
      }
      processar_prazos_vencidos: { Args: never; Returns: number }
      public_processos_stats: {
        Args: never
        Returns: {
          em_tramitacao: number
          julgados: number
          total: number
        }[]
      }
      remeter_em_grau_de_recurso: {
        Args: { _observacao?: string; _processo_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "advogado"
        | "cidadao"
        | "servidor"
        | "magistrado"
        | "promotor"
        | "admin"
        | "desembargador"
        | "ministro_stj"
        | "ministro_stf"
        | "defensoria"
        | "defensor"
      audiencia_modalidade: "presencial" | "virtual" | "hibrida"
      audiencia_status: "designada" | "redesignada" | "cancelada" | "realizada"
      fila_conclusao:
        | "despacho"
        | "decisao"
        | "sentenca"
        | "urgente"
        | "minuta_pendente"
      fila_servidor:
        | "expedientes_pendentes"
        | "comunicacoes_pendentes"
        | "peticoes_pendentes"
        | "distribuicao_pendente"
        | "cumprimento_sentenca"
        | "prazo_vencido"
      habilitacao_status: "pendente" | "deferida" | "indeferida" | "cancelada"
      processo_status:
        | "em_tramitacao"
        | "arquivado"
        | "suspenso"
        | "baixado"
        | "julgado"
      tipo_documento:
        | "peticao_inicial"
        | "peticao"
        | "prova"
        | "despacho"
        | "decisao"
        | "sentenca"
        | "minuta"
        | "outros"
        | "mandado"
        | "certidao"
        | "contestacao"
        | "replica"
        | "parecer"
        | "laudo"
        | "manifestacao_mp"
        | "oficio"
        | "prova_documental"
        | "contrato"
        | "ata"
      tipo_movimentacao:
        | "despacho"
        | "decisao"
        | "sentenca"
        | "peticao"
        | "juntada"
        | "distribuicao"
        | "intimacao"
        | "mandado"
        | "retificacao"
      tipo_parte: "autor" | "reu" | "terceiro" | "advogado" | "mp"
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
      app_role: [
        "advogado",
        "cidadao",
        "servidor",
        "magistrado",
        "promotor",
        "admin",
        "desembargador",
        "ministro_stj",
        "ministro_stf",
        "defensoria",
        "defensor",
      ],
      audiencia_modalidade: ["presencial", "virtual", "hibrida"],
      audiencia_status: ["designada", "redesignada", "cancelada", "realizada"],
      fila_conclusao: [
        "despacho",
        "decisao",
        "sentenca",
        "urgente",
        "minuta_pendente",
      ],
      fila_servidor: [
        "expedientes_pendentes",
        "comunicacoes_pendentes",
        "peticoes_pendentes",
        "distribuicao_pendente",
        "cumprimento_sentenca",
        "prazo_vencido",
      ],
      habilitacao_status: ["pendente", "deferida", "indeferida", "cancelada"],
      processo_status: [
        "em_tramitacao",
        "arquivado",
        "suspenso",
        "baixado",
        "julgado",
      ],
      tipo_documento: [
        "peticao_inicial",
        "peticao",
        "prova",
        "despacho",
        "decisao",
        "sentenca",
        "minuta",
        "outros",
        "mandado",
        "certidao",
        "contestacao",
        "replica",
        "parecer",
        "laudo",
        "manifestacao_mp",
        "oficio",
        "prova_documental",
        "contrato",
        "ata",
      ],
      tipo_movimentacao: [
        "despacho",
        "decisao",
        "sentenca",
        "peticao",
        "juntada",
        "distribuicao",
        "intimacao",
        "mandado",
        "retificacao",
      ],
      tipo_parte: ["autor", "reu", "terceiro", "advogado", "mp"],
    },
  },
} as const
