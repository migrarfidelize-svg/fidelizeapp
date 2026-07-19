-- 0002_enums.sql
CREATE TYPE public.campaign_type AS ENUM ('stamps','points');
CREATE TYPE public.customer_tier AS ENUM ('bronze','prata','ouro','diamante');
CREATE TYPE public.helpdesk_role AS ENUM ('hd_admin','hd_agent');
CREATE TYPE public.member_role AS ENUM ('owner','manager','staff');
CREATE TYPE public.plan_tier AS ENUM ('free','starter','pro','enterprise');
CREATE TYPE public.platform_role AS ENUM ('super_admin');
CREATE TYPE public.support_author_type AS ENUM ('customer','admin','system');
CREATE TYPE public.support_category AS ENUM ('qrcode','campanhas','pagamentos','conta','outro','sugestao','duvidas','tecnico','carimbos','clientes');
CREATE TYPE public.support_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.support_status AS ENUM ('open','in_progress','waiting_customer','answered','resolved','closed');
CREATE TYPE public.ticket_author_type AS ENUM ('agent','customer','system');
CREATE TYPE public.ticket_channel AS ENUM ('form','email','chat','agent');
CREATE TYPE public.ticket_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.ticket_status AS ENUM ('open','pending','on_hold','solved','closed');
