-- Barangay-only RLS Policies Migration
-- Fixes syntax for PostgreSQL versions that don't support multiple operations in FOR clause

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow authenticated access" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.resources;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.booking_request;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.barangays;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.approval;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.facility_details;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.vehicle_details;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.asset_logs;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.email_change_logs;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.google_oauth_temp_tokens;

-- Users: Staff & admin only access
CREATE POLICY "Users - Staff/Admin access only" ON public.users
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

-- Resources: Staff read, Admin CRUD
CREATE POLICY "Resources - Staff read only" ON public.resources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Resources - Admin INSERT" ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Resources - Admin UPDATE" ON public.resources
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Resources - Admin DELETE" ON public.resources
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Booking Requests: Staff create/view, Admin manage
CREATE POLICY "Bookings - Staff SELECT" ON public.booking_request
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Bookings - Staff INSERT" ON public.booking_request
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Bookings - Admin UPDATE" ON public.booking_request
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Bookings - Admin DELETE" ON public.booking_request
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Notifications: Staff read, Admin manage
CREATE POLICY "Notifications - Staff read" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Notifications - Admin INSERT" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Notifications - Admin UPDATE" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Notifications - Admin DELETE" ON public.notifications
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Approval: Staff read, Admin manage
CREATE POLICY "Approval - Staff read" ON public.approval
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Approval - Admin INSERT" ON public.approval
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Approval - Admin UPDATE" ON public.approval
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Approval - Admin DELETE" ON public.approval
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Facility Details: Staff read, Admin manage
CREATE POLICY "Facility Details - Staff read" ON public.facility_details
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Facility Details - Admin INSERT" ON public.facility_details
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Facility Details - Admin UPDATE" ON public.facility_details
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Facility Details - Admin DELETE" ON public.facility_details
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Vehicle Details: Staff read, Admin manage
CREATE POLICY "Vehicle Details - Staff read" ON public.vehicle_details
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Vehicle Details - Admin INSERT" ON public.vehicle_details
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Vehicle Details - Admin UPDATE" ON public.vehicle_details
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Vehicle Details - Admin DELETE" ON public.vehicle_details
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Asset Logs: Staff read, Admin manage
CREATE POLICY "Asset Logs - Staff read" ON public.asset_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Asset Logs - Admin INSERT" ON public.asset_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Asset Logs - Admin UPDATE" ON public.asset_logs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Asset Logs - Admin DELETE" ON public.asset_logs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Email Change Logs: Staff read, Admin manage
CREATE POLICY "Email Logs - Staff read" ON public.email_change_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Email Logs - Admin INSERT" ON public.email_change_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Email Logs - Admin UPDATE" ON public.email_change_logs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Email Logs - Admin DELETE" ON public.email_change_logs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Barangays: Public read for dropdown, Staff/Admin write
CREATE POLICY "Barangays - Public read" ON public.barangays
  FOR SELECT TO anon USING (true);

CREATE POLICY "Barangays - Staff/Admin write" ON public.barangays
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Barangays - Staff/Admin UPDATE" ON public.barangays
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Barangays - Staff/Admin DELETE" ON public.barangays
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role IN ('staff', 'admin')
    )
  );

-- Google OAuth Temp Tokens: Admin only
CREATE POLICY "Google OAuth - Admin only" ON public.google_oauth_temp_tokens
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.user_id = auth.uid() 
      AND u.role = 'admin'
    )
  );
