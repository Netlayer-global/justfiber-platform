# Installer App QA Checklist

Use this checklist before calling the installer app production-ready.

## 1. Auth And Session

- Login with valid installer credentials
- Login with invalid password and verify readable error
- Kill app and reopen it
- Confirm session restore works
- Use logout and confirm the logout sheet appears
- Confirm logout clears session and returns to login

## 2. Dashboard

- Dashboard loads without layout break
- Today, Pending, and Completed counts render
- Pull-to-refresh updates dashboard data
- Availability badge matches profile state

## 3. Jobs Queue

- Jobs list opens with active jobs
- Search works for customer name
- Search works for phone number
- Search works for address
- Queue filters work:
  - All
  - Install
  - Complaint
  - Exceptions
  - Closed
- Open map works when location exists
- Call customer works when phone exists
- Accept action works from queue
- Start travel works from queue
- Quick preview works from queue

## 4. Installation Workflow

- Open installation job detail
- Accept job
- Start travel
- Mark onsite
- Scan ONT serial
- Manual serial entry also works
- Load preview works
- Diagnostics refresh works
- Activation starts successfully
- Activation retry works when config fails
- Proof photos can be captured
- Proof submit works
- Completion OTP can be sent
- Completion OTP verify works
- Complete installation closes job

## 5. Complaint Workflow

- Open complaint job detail
- Accept complaint
- Start travel
- Mark onsite
- Start complaint workflow
- Change resolution code
- Add complaint note
- Replace ONT flow works
- Complaint OTP can be sent
- Complaint OTP verify works
- Resolve complaint closes job

## 6. Serial Scanner

- Camera opens successfully
- Barcode scan fills serial
- QR scan fills serial
- Cancel returns safely
- Use code button works

## 7. Notifications

- Alerts list loads
- Opening alert marks it read
- Related job deep-link opens correct job
- Mark all read works
- Pull-to-refresh updates alert list

## 8. Profile And Availability

- Profile details load
- Start leave works
- End leave works
- Availability chip updates correctly
- Refresh button works

## 9. Error And Edge Cases

- No network during refresh
- No network during proof upload
- No network during OTP send
- No network during completion
- Invalid OTP shows clear message
- Empty serial shows clear message
- Empty complaint replacement serial shows clear message
- Empty complaint note guard works if expected

## 10. Final Backend Checks

- Installer completion creates correct backend status
- Complaint resolution updates admin side
- ONT replacement saves old and new serial
- Proof URLs persist correctly
- Activation status reflects real backend state
- Invoice generation confirmation appears in downstream systems if enabled

## Signoff

- Auth pass
- Dashboard pass
- Jobs queue pass
- Installation flow pass
- Complaint flow pass
- Notifications pass
- Profile pass
- Backend sync pass

