import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
import 'booking_payment_screen.dart';
import 'service_tracking_screen.dart';

class BookingFlowScreen extends StatefulWidget {
  const BookingFlowScreen({super.key, this.initialMobile});

  final String? initialMobile;

  @override
  State<BookingFlowScreen> createState() => _BookingFlowScreenState();
}

class _BookingFlowScreenState extends State<BookingFlowScreen> {
  static const _slotOptions = [
    ('morning', '10 AM - 1 PM'),
    ('afternoon', '1 PM - 4 PM'),
    ('evening', '4 PM - 7 PM'),
  ];

  int step = 0;
  String? selectedPlanCode;
  int _selectedDurationMonths = 1;
  String _selectedDurationLabel = '1 month';
  static const String _selectedPaymentMode = 'razorpay';
  String? _selectedSlotCode = 'morning';
  String? _selectedSlotLabel = '10 AM - 1 PM';
  DateTime _preferredDate = DateTime.now().add(const Duration(days: 1));
  final MapController _mapController = MapController();
  LatLng _selectedLocation = const LatLng(28.6139, 77.2090);
  bool _hasPickedLocation = false;
  bool _locationBusy = false;
  String? _locationError;
  bool _locationPermissionDeniedForever = false;
  bool _locationServiceDisabled = false;
  bool _usedCurrentLocation = false;
  bool _showUnavailableState = false;
  final nameController = TextEditingController();
  final mobileController = TextEditingController();
  final emailController = TextEditingController();
  final addressController = TextEditingController();
  final pinController = TextEditingController();

  @override
  void dispose() {
    nameController.dispose();
    mobileController.dispose();
    emailController.dispose();
    addressController.dispose();
    pinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final session = appState.session;
    final plans = appState.plans;
    final latestBooking = appState.latestBooking;
    final selectedPlan = _selectedPlan(plans);

    if (nameController.text.isEmpty && session != null) {
      nameController.text = appState.dashboard.customerName;
    }
    if (mobileController.text.isEmpty) {
      mobileController.text = session?.mobile ?? widget.initialMobile ?? '';
    }

    return Scaffold(
      appBar: AppBar(
        title: Column(
          children: [
            Text('Book Wi-Fi', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 2),
            const Text('Address, plan, and booking in one flow', style: TextStyle(fontSize: 15, color: Color(0xFF64748B))),
          ],
        ),
        centerTitle: true,
        backgroundColor: const Color(0xFFF6F1EB),
        foregroundColor: const Color(0xFF131313),
      ),
      backgroundColor: const Color(0xFFF6F1EB),
      body: RefreshIndicator(
        color: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFFF6F1EB),
        onRefresh: appState.refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
          children: [
          _heroBanner(selectedPlan),
          const SizedBox(height: 18),
          _stepper(),
          const SizedBox(height: 20),
          if (step == 0) _addressStep(appState),
          if (step == 1) _planStep(appState, plans),
          if (step == 2) _durationStep(plans),
          if (step == 3) _bookingStep(appState, plans),
          if (step == 4 && latestBooking != null) _successStep(latestBooking),
          ],
        ),
      ),
    );
  }

  Widget _addressStep(AppState appState) {
    final feasibility = appState.feasibility;
    if (_showUnavailableState && feasibility != null && !feasibility.feasible) {
      return _unavailableState(appState, feasibility.message);
    }
    return _sectionCard(
      title: 'Confirm service address',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Unlock plans and offers available in your area.', style: TextStyle(color: Color(0xFF6B7280), height: 1.4)),
          const SizedBox(height: 16),
          _addressChecklist(),
          const SizedBox(height: 16),
          _field('Full name', nameController),
          const SizedBox(height: 12),
          _field('Mobile number', mobileController, keyboardType: TextInputType.phone),
          const SizedBox(height: 12),
          _field('Email address', emailController, keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          _field('Address', addressController, maxLines: 3),
          const SizedBox(height: 12),
          _field('Pin code', pinController, keyboardType: TextInputType.number),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonal(
                  onPressed: _locationBusy ? null : _fetchCurrentLocation,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFFFFFFF),
                    foregroundColor: const Color(0xFF131313),
                  ),
                  child: Text(_locationBusy ? 'Fetching location...' : 'Use Current Location'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            height: 260,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0x338224E3)),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _selectedLocation,
                    initialZoom: 16,
                    onTap: (_, point) {
                      setState(() {
                        _selectedLocation = point;
                        _hasPickedLocation = true;
                        _locationError = null;
                        _usedCurrentLocation = false;
                      });
                      _mapController.move(point, 16);
                    },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.justfiber.customer',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: _selectedLocation,
                          width: 48,
                          height: 48,
                          child: const Icon(Icons.location_pin, size: 42, color: Color(0xFFD81F26)),
                        ),
                      ],
                    ),
                  ],
                ),
                const Positioned(
                  top: 12,
                  left: 12,
                  right: 12,
                  child: _MapHint(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            _hasPickedLocation
                ? 'Pinned location: ${_selectedLocation.latitude.toStringAsFixed(6)}, ${_selectedLocation.longitude.toStringAsFixed(6)}'
                : 'Tap on the map to drop the exact install location pin.',
            style: const TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.w600),
          ),
          if (_hasPickedLocation) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8F4FF),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: const Color(0x558224E3)),
                  ),
                  child: Text(
                    _usedCurrentLocation ? 'Current GPS pin' : 'Manual map pin',
                    style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700),
                  ),
                ),
                OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _hasPickedLocation = false;
                      _usedCurrentLocation = false;
                      _locationError = null;
                      _selectedLocation = const LatLng(28.6139, 77.2090);
                    });
                    _mapController.move(_selectedLocation, 14);
                  },
                  child: const Text('Reset pin'),
                ),
              ],
            ),
          ],
          if ((_locationError ?? '').isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(_locationError!, style: const TextStyle(color: Color(0xFFB91C1C), fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                if (_locationServiceDisabled)
                  OutlinedButton(
                    onPressed: Geolocator.openLocationSettings,
                    child: const Text('Open location settings'),
                  ),
                if (_locationPermissionDeniedForever)
                  OutlinedButton(
                    onPressed: Geolocator.openAppSettings,
                    child: const Text('Open app settings'),
                  ),
                OutlinedButton(
                  onPressed: _locationBusy ? null : _fetchCurrentLocation,
                  child: const Text('Try again'),
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          if (feasibility != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: feasibility.feasible ? const Color(0xFF0D1A12) : const Color(0xFF220B0B),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: feasibility.feasible ? const Color(0x668224E3) : const Color(0x66EF4444),
                ),
              ),
              child: Text(
                feasibility.message,
                style: TextStyle(
                  color: feasibility.feasible ? const Color(0xFF8224E3) : const Color(0xFFFCA5A5),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: appState.bookingBusy
                  ? null
                  : () async {
                      if (!_validateAddressStep()) return;
                      final ok = await appState.checkFeasibility(
                        address: addressController.text.trim(),
                        pinCode: pinController.text.trim(),
                        lat: _selectedLocation.latitude,
                        lng: _selectedLocation.longitude,
                      );
                      if (!mounted) return;
                      if (ok) {
                        if (appState.plans.isEmpty) {
                          await appState.refreshPlans();
                          if (!mounted) return;
                        }
                        setState(() => _showUnavailableState = false);
                        setState(() => step = 1);
                      } else {
                        final leadNumber = await appState.submitFeasibilityLead(
                          fullName: nameController.text.trim(),
                          mobile: mobileController.text.trim(),
                          address: addressController.text.trim(),
                          pinCode: pinController.text.trim(),
                          lat: _selectedLocation.latitude,
                          lng: _selectedLocation.longitude,
                        );
                        if (!mounted) return;
                        setState(() => _showUnavailableState = true);
                        ScaffoldMessenger.of(context).hideCurrentSnackBar();
                        if (leadNumber != null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Lead $leadNumber has been created for manual follow-up.'),
                            ),
                          );
                        }
                      }
                    },
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF8224E3), foregroundColor: const Color(0xFFFFFFFF)),
                              child: Text(appState.bookingBusy ? 'Checking...' : 'Confirm & View Plans'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _unavailableState(AppState appState, String message) {
    return Container(
      constraints: const BoxConstraints(minHeight: 520),
      alignment: Alignment.center,
      child: AppCard(
        color: const Color(0xFFFFFFFF),
        borderColor: const Color(0x22EF4444),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 74,
              height: 74,
              decoration: BoxDecoration(
                color: const Color(0xFFFDF2F2),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0x33EF4444)),
              ),
              child: const Icon(Icons.location_off_rounded, color: Color(0xFFDC2626), size: 38),
            ),
            const SizedBox(height: 18),
            const Text(
              'We are not live here yet',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF131313)),
            ),
            const SizedBox(height: 10),
            Text(
              message.isEmpty ? 'This address is outside our live serviceability map right now.' : message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF6E6A67), height: 1.5, fontSize: 15),
            ),
            const SizedBox(height: 12),
            const Text(
              'Your inquiry has been captured for rollout and manual follow-up.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => setState(() => _showUnavailableState = false),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF8224E3),
                  foregroundColor: const Color(0xFFFFFFFF),
                ),
                child: const Text('Update address or pin'),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: appState.bookingBusy
                    ? null
                    : () async {
                        final ok = await appState.checkFeasibility(
                          address: addressController.text.trim(),
                          pinCode: pinController.text.trim(),
                          lat: _selectedLocation.latitude,
                          lng: _selectedLocation.longitude,
                        );
                        if (!mounted) return;
                        if (ok) {
                          if (appState.plans.isEmpty) {
                            await appState.refreshPlans();
                            if (!mounted) return;
                          }
                          setState(() {
                            _showUnavailableState = false;
                            step = 1;
                          });
                        }
                      },
                child: const Text('Check again'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _planStep(AppState appState, List<dynamic> plans) {
    return _sectionCard(
      title: 'Popular plans',
      child: Column(
        children: [
          if (plans.isEmpty) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFFF8F4FF),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0x338224E3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Plans are loading',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF131313)),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    (appState.error ?? '').isNotEmpty
                        ? 'Plan catalog abhi load nahi hui. ${appState.error}'
                        : 'Serviceability check complete hai, but plan catalog abhi fetch nahi hui. Retry once.',
                    style: const TextStyle(color: Color(0xFF6B7280), height: 1.45),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () async {
                        await appState.refreshPlans();
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                      ),
                      child: const Text('Reload plans'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          for (final plan in plans)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _planTile(
                planName: plan.name,
                speed: '${plan.speedMbps.toStringAsFixed(0)} Mbps',
                upload: '${plan.uploadSpeedMbps.toStringAsFixed(0)} Mbps',
                data: plan.dataPolicy == 'unlimited' ? 'Unlimited' : '${plan.dataLimitGb.toStringAsFixed(0)} GB',
                price: 'Rs ${plan.monthlyPrice.toStringAsFixed(0)} /m + GST',
                selected: selectedPlanCode == plan.planCode,
                onSelect: () => setState(() => selectedPlanCode = plan.planCode),
              ),
            ),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: selectedPlanCode == null
                  ? null
                  : () {
                      final selected = plans.cast<dynamic?>().firstWhere(
                            (item) => item?.planCode == selectedPlanCode,
                            orElse: () => null,
                          );
                      if (selected != null) {
                        final defaultDuration = _availableDurations(selected).first;
                        _selectedDurationMonths = defaultDuration.$1;
                        _selectedDurationLabel = defaultDuration.$2;
                      }
                      setState(() => step = 2);
                    },
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
              ),
              child: const Text('Continue to Duration'),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => setState(() => step = 0),
              child: const Text('Back to Address'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _durationStep(List<dynamic> plans) {
    dynamic selected;
    for (final item in plans) {
      if (item.planCode == selectedPlanCode) {
        selected = item;
        break;
      }
    }
    final durations = selected == null ? const <(int, String)>[(1, '1 month')] : _availableDurations(selected);
    final recurringAmount = selected == null ? 0.0 : _priceForDuration(selected, _selectedDurationMonths);
    final setupAmount = selected == null
        ? 0.0
        : ((selected.otcCharge ?? 0) as num).toDouble() + ((selected.installationCharge ?? 0) as num).toDouble();
    final totalAmount = recurringAmount + setupAmount;

    return _sectionCard(
      title: 'Choose plan duration',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            selected == null
                ? 'Select a plan first to continue.'
                : 'Pick billing duration for ${selected.name}. Total payable will update automatically.',
            style: const TextStyle(color: Color(0xFF6B7280), height: 1.45),
          ),
          const SizedBox(height: 16),
          for (final option in durations)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _durationTile(
                label: option.$2,
                recurringAmount: _priceForDuration(selected, option.$1),
                setupAmount: setupAmount,
                selected: _selectedDurationMonths == option.$1,
                onSelect: () => setState(() {
                  _selectedDurationMonths = option.$1;
                  _selectedDurationLabel = option.$2;
                }),
              ),
            ),
          const SizedBox(height: 8),
          _summaryRow('Selected duration', _selectedDurationLabel),
          _summaryRow('Recurring amount', 'Rs ${recurringAmount.toStringAsFixed(0)}'),
          _summaryRow('Setup charges', 'Rs ${setupAmount.toStringAsFixed(0)}'),
          _summaryRow('Payable now', 'Rs ${totalAmount.toStringAsFixed(0)}'),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: selected == null ? null : () => setState(() => step = 3),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF8224E3),
                foregroundColor: const Color(0xFFFFFFFF),
              ),
              child: const Text('Continue to Booking'),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => setState(() => step = 1),
              child: const Text('Back to Plans'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bookingStep(AppState appState, List<dynamic> plans) {
    final selected = _selectedPlan(plans);

    return _sectionCard(
      title: 'Review checkout',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Check customer details, plan, and payable amount before opening secure payment.',
            style: TextStyle(color: Color(0xFF6B7280), height: 1.45),
          ),
          const SizedBox(height: 16),
          _summaryRow('Customer', nameController.text.trim().isEmpty ? '-' : nameController.text.trim()),
          _summaryRow('Mobile', mobileController.text.trim().isEmpty ? '-' : mobileController.text.trim()),
          _summaryRow('Email', emailController.text.trim().isEmpty ? '-' : emailController.text.trim()),
          _summaryRow('Address', addressController.text.trim().isEmpty ? '-' : addressController.text.trim()),
          _summaryRow('Pin code', pinController.text.trim().isEmpty ? '-' : pinController.text.trim()),
          _summaryRow('Pinned coordinates', '${_selectedLocation.latitude.toStringAsFixed(6)}, ${_selectedLocation.longitude.toStringAsFixed(6)}'),
          _summaryRow('Plan', selected?.name ?? '-'),
          _summaryRow('Speed', selected == null ? '-' : '${selected.speedMbps.toStringAsFixed(0)} Mbps'),
          _summaryRow('Upload', selected == null ? '-' : '${selected.uploadSpeedMbps.toStringAsFixed(0)} Mbps'),
          _summaryRow('Duration', _selectedDurationLabel),
          _summaryRow('Payable now', 'Rs ${_bookingAmountFor(selected).toStringAsFixed(0)}'),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0x33F59E0B)),
            ),
            child: const Text(
              'Payment completes the booking first. Preferred install date and slot are confirmed in the next step.',
              style: TextStyle(color: Color(0xFF92400E), fontWeight: FontWeight.w700, height: 1.45),
            ),
          ),
          const SizedBox(height: 16),
          const Text('Secure payment', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F4FF),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0x228224E3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.lock_rounded, color: Color(0xFF8224E3)),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Razorpay checkout will open next',
                    style: TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          if (appState.session == null) ...[
            const SizedBox(height: 8),
            const Text(
              'Login is required before opening secure payment checkout.',
              style: TextStyle(color: Color(0xFF6B7280), height: 1.4),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: appState.bookingBusy || appState.session == null
                  ? null
                  : () async {
                      final ok = await appState.createBooking(
                        planCode: selectedPlanCode!,
                        fullName: nameController.text.trim(),
                        mobile: mobileController.text.trim(),
                        email: emailController.text.trim(),
                        address: addressController.text.trim(),
                        pinCode: pinController.text.trim(),
                        lat: _selectedLocation.latitude,
                        lng: _selectedLocation.longitude,
                        durationMonths: _selectedDurationMonths,
                        durationLabel: _selectedDurationLabel,
                        paymentMode: _selectedPaymentMode,
                      );
                      if (!mounted) return;
                      if (ok) {
                        final order = await appState.loadBookingPaymentOrder(
                          bookingNumber: appState.latestBooking!.bookingNumber,
                          amount: appState.latestBooking!.amount,
                        );
                        if (!mounted) return;
                        if (order != null) {
                          final paid = await Navigator.of(context).push<bool>(
                            MaterialPageRoute(
                              builder: (_) => BookingPaymentScreen(
                                bookingNumber: appState.latestBooking!.bookingNumber,
                                paymentOrder: order,
                              ),
                            ),
                          );
                          if (!mounted) return;
                          if (paid == true) {
                            await appState.refresh();
                            setState(() => step = 4);
                          }
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(appState.error ?? 'Unable to start booking payment')),
                          );
                        }
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(appState.bookingError ?? 'Unable to create booking')),
                        );
                      }
                    },
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF8224E3), foregroundColor: const Color(0xFFFFFFFF)),
              child: Text(appState.bookingBusy ? 'Preparing checkout...' : 'Pay now'),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: appState.bookingBusy ? null : () => setState(() => step = 2),
              child: const Text('Back to Duration'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _successStep(dynamic latestBooking) {
    return _sectionCard(
      title: 'Confirm install slot',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF8224E3), Color(0xFF9B51E0)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: const Color(0x26FFFFFF),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0x55FFFFFF)),
                      ),
                      child: const Icon(Icons.event_available_rounded, color: Color(0xFFFFFFFF)),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Payment received',
                        style: TextStyle(color: Color(0xFFFFFFFF), fontWeight: FontWeight.w900, fontSize: 22),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  'Booking ${latestBooking.bookingNumber} is ${latestBooking.status}.',
                  style: const TextStyle(color: Color(0xFFFFFFFF), fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Pick your preferred date and install slot so operations can schedule the visit correctly.',
                  style: TextStyle(color: Color(0xFFF3E8FF), height: 1.45),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _successChip('Booking ID', latestBooking.bookingNumber),
              _successChip('Status', latestBooking.status.replaceAll('_', ' ')),
              _successChip('Duration', latestBooking.durationLabel),
            ],
          ),
          const SizedBox(height: 16),
          _summaryRow('Plan', latestBooking.planName),
          _summaryRow('Amount', 'Rs ${latestBooking.amount.toStringAsFixed(0)}'),
          _summaryRow('Duration', latestBooking.durationLabel),
          _summaryRow('Current step', latestBooking.currentStep),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F4FF),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0x228224E3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Install summary',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF131313)),
                ),
                const SizedBox(height: 10),
                _summaryRow('Install address', addressController.text.trim().isEmpty ? '-' : addressController.text.trim()),
                _summaryRow('Pin code', pinController.text.trim().isEmpty ? '-' : pinController.text.trim()),
                _summaryRow('Map pin', '${_selectedLocation.latitude.toStringAsFixed(6)}, ${_selectedLocation.longitude.toStringAsFixed(6)}'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text('Choose install date', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 10),
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemBuilder: (_, index) {
                final date = DateTime.now().add(Duration(days: index + 1));
                final selectedDate = _isSameDate(date, _preferredDate);
                return ChoiceChip(
                  label: Text(_formatDate(date)),
                  selected: selectedDate,
                  backgroundColor: const Color(0xFFF8F4FF),
                  selectedColor: const Color(0xFF8224E3),
                  side: BorderSide(color: selectedDate ? const Color(0xFF8224E3) : const Color(0x228224E3)),
                  labelStyle: TextStyle(
                    color: selectedDate ? const Color(0xFF111111) : const Color(0xFF131313),
                    fontWeight: FontWeight.w700,
                  ),
                  onSelected: (_) => setState(() => _preferredDate = date),
                );
              },
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemCount: 5,
            ),
          ),
          const SizedBox(height: 12),
          const Text('Choose install slot', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: _slotOptions.map((slot) {
              final selectedSlot = _selectedSlotCode == slot.$1;
              return ChoiceChip(
                label: Text(slot.$2),
                selected: selectedSlot,
                backgroundColor: const Color(0xFFF8F4FF),
                selectedColor: const Color(0xFF8224E3),
                side: BorderSide(color: selectedSlot ? const Color(0xFF8224E3) : const Color(0x228224E3)),
                labelStyle: TextStyle(
                  color: selectedSlot ? const Color(0xFF111111) : const Color(0xFF131313),
                  fontWeight: FontWeight.w700,
                ),
                onSelected: (_) {
                  setState(() {
                    _selectedSlotCode = slot.$1;
                    _selectedSlotLabel = slot.$2;
                  });
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          _summaryRow('Preferred date', _formatDate(_preferredDate)),
          _summaryRow('Preferred slot', _selectedSlotLabel ?? '-'),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFFFF),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0x228224E3)),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('What happens next?', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF131313))),
                SizedBox(height: 8),
                Text('1. Operations and installer teams can now see this booking.', style: TextStyle(color: Color(0xFF6E6A67))),
                SizedBox(height: 4),
                Text('2. The exact map pin and preferred install slot are attached to the job.', style: TextStyle(color: Color(0xFF6E6A67))),
                SizedBox(height: 4),
                Text('3. You can track updates from the booking and service tracking screen.', style: TextStyle(color: Color(0xFF6E6A67))),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: AppStateScope.of(context).busy
                  ? null
                  : () async {
                      final ok = await AppStateScope.of(context).saveBookingPreferences(
                        bookingNumber: latestBooking.bookingNumber,
                        preferredDate: _preferredDate.toIso8601String(),
                        preferredSlotCode: _selectedSlotCode,
                        preferredSlotLabel: _selectedSlotLabel,
                      );
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(ok ? 'Booking confirmed and slot saved.' : (AppStateScope.of(context).error ?? 'Unable to save slot preference')),
                        ),
                      );
                    },
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF8224E3), foregroundColor: const Color(0xFFFFFFFF)),
              child: const Text('Save slot and confirm'),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
                    );
                    if (context.mounted) {
                      await AppStateScope.of(context).refreshBookingTracking();
                    }
                  },
                  child: const Text('Track Booking'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () async {
                    await AppStateScope.of(context).refreshBookingTracking();
                    if (!context.mounted) return;
                    Navigator.of(context).pop();
                  },
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFF8224E3), foregroundColor: const Color(0xFFFFFFFF)),
                  child: const Text('Done'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => setState(() {
                step = 0;
                selectedPlanCode = null;
                _selectedDurationMonths = 1;
                _selectedDurationLabel = '1 month';
                _selectedSlotCode = 'morning';
                _selectedSlotLabel = '10 AM - 1 PM';
                _preferredDate = DateTime.now().add(const Duration(days: 1));
                _selectedLocation = const LatLng(28.6139, 77.2090);
                _hasPickedLocation = false;
                _locationError = null;
                nameController.clear();
                mobileController.text = AppStateScope.of(context).session?.mobile ?? widget.initialMobile ?? '';
                addressController.clear();
                pinController.clear();
                AppStateScope.of(context).clearBookingDraft();
              }),
              child: const Text('Create another booking'),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () async {
                await AppStateScope.of(context).refresh();
                if (!context.mounted) return;
                Navigator.of(context).pop();
              },
              child: const Text('Return to App Home'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _successChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x558224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontSize: 11, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _heroBanner(dynamic selectedPlan) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: const Color(0x228224E3)),
        boxShadow: const [
          BoxShadow(color: Color(0x14000000), blurRadius: 18, offset: Offset(0, 8)),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'BOOKING CONSOLE',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: const Color(0xFF6E6A67),
                          letterSpacing: 3.2,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 10),
                  const Text('Book new Wi-Fi', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Color(0xFF131313))),
                  const SizedBox(height: 6),
                  const Text(
                    'Select your plan, confirm address, and create a live booking with an exact install map pin.',
                    style: TextStyle(color: Color(0xFF6E6A67), height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _progressChip('Step', '${step + 1}/5'),
                      _progressChip('Plan', selectedPlan?.name ?? 'Not selected'),
                      _progressChip('Duration', _selectedDurationLabel),
                      _progressChip('Mobile', mobileController.text.trim().isEmpty ? '-' : mobileController.text.trim()),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F4FF),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0x228224E3)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.verified_user_rounded, size: 18, color: Color(0xFF8224E3)),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Secure booking, live feasibility, and slot confirmation in one flow.',
                            style: TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w600, height: 1.35),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Container(
            width: 120,
            height: 120,
            margin: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F4FF),
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: const Color(0x668224E3)),
            ),
            child: const Icon(Icons.wifi_rounded, color: Color(0xFF8224E3), size: 56),
          ),
        ],
      ),
    );
  }

  Widget _addressChecklist() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Complete these before checking plans',
            style: TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          _checkItem('Full name', nameController.text.trim().isNotEmpty),
          _checkItem('Mobile number', mobileController.text.trim().length >= 10),
          _checkItem('Address', addressController.text.trim().length >= 5),
          _checkItem('Pin code', pinController.text.trim().length >= 4),
          _checkItem('Map pin dropped', _hasPickedLocation),
        ],
      ),
    );
  }

  Widget _checkItem(String label, bool done) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(
            done ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
            size: 18,
            color: done ? const Color(0xFF8224E3) : const Color(0xFF6B7280),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: done ? const Color(0xFF131313) : const Color(0xFF6E6A67),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  bool _validateAddressStep() {
    final messenger = ScaffoldMessenger.of(context);
    if (nameController.text.trim().length < 2) {
      messenger.showSnackBar(const SnackBar(content: Text('Enter customer name before continuing.')));
      return false;
    }
    final mobile = mobileController.text.trim();
    if (mobile.length != 10 || int.tryParse(mobile) == null) {
      messenger.showSnackBar(const SnackBar(content: Text('Enter a valid 10-digit mobile number before continuing.')));
      return false;
    }
    if (addressController.text.trim().length < 5) {
      messenger.showSnackBar(const SnackBar(content: Text('Enter installation address before continuing.')));
      return false;
    }
    if (pinController.text.trim().length < 4) {
      messenger.showSnackBar(const SnackBar(content: Text('Enter a valid pin code before continuing.')));
      return false;
    }
    if (!_hasPickedLocation) {
      messenger.showSnackBar(const SnackBar(content: Text('Drop the exact installation pin on the map.')));
      return false;
    }
    return true;
  }

  bool _isSameDate(DateTime left, DateTime right) {
    return left.year == right.year && left.month == right.month && left.day == right.day;
  }

  String _formatDate(DateTime date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${date.day} ${months[date.month - 1]}';
  }

  Future<void> _fetchCurrentLocation() async {
    setState(() {
      _locationBusy = true;
      _locationError = null;
      _locationPermissionDeniedForever = false;
      _locationServiceDisabled = false;
    });
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() => _locationServiceDisabled = true);
        throw Exception('Location services are turned off.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        setState(() => _locationPermissionDeniedForever = true);
        throw Exception('Location permission is permanently denied. Open app settings and allow location access.');
      }
      if (permission == LocationPermission.denied) {
        throw Exception('Location permission is required to fetch current location.');
      }
      final position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() {
        _selectedLocation = LatLng(position.latitude, position.longitude);
        _hasPickedLocation = true;
        _usedCurrentLocation = true;
      });
      _mapController.move(_selectedLocation, 17);
      _showLocationFeedback('Current location pinned on the map.');
    } catch (e) {
      setState(() {
        _locationError = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _locationBusy = false;
        });
      }
    }
  }

  void _showLocationFeedback(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Widget _stepper() {
    final labels = ['Address', 'Select Plan', 'Duration', 'Checkout', 'Confirm'];
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Step ${step + 1} of ${labels.length}',
                style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700),
              ),
            ),
            Text(
              labels[step],
              style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFFFF),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0x228224E3)),
          ),
          child: Row(
            children: List.generate(labels.length, (index) {
              final active = index <= step;
              final current = index == step;
              return Expanded(
                child: Column(
                  children: [
                    Container(
                      height: 6,
                      margin: EdgeInsets.only(left: index == 0 ? 12 : 4, right: index == labels.length - 1 ? 12 : 4),
                      decoration: BoxDecoration(
                        color: active ? const Color(0xFF8224E3) : const Color(0xFFE7E2DD),
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      labels[index],
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: current ? FontWeight.w800 : FontWeight.w700,
                        color: active ? const Color(0xFF131313) : const Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),
        ),
      ],
    );
  }

  dynamic _selectedPlan(List<dynamic> plans) {
    for (final item in plans) {
      if (item.planCode == selectedPlanCode) {
        return item;
      }
    }
    return null;
  }

  Widget _progressChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFF131313), fontSize: 12),
          children: [
            TextSpan(text: '$label ', style: const TextStyle(fontWeight: FontWeight.w600)),
            TextSpan(text: value, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }

  List<(int, String)> _availableDurations(dynamic plan) {
    final durations = <(int, String)>[];
    final monthlyPrice = ((plan.monthlyPrice ?? 0) as num).toDouble();
    final quarterlyPrice = ((plan.quarterlyPrice ?? 0) as num).toDouble();
    final halfYearlyPrice = ((plan.halfYearlyPrice ?? 0) as num).toDouble();
    final yearlyPrice = ((plan.yearlyPrice ?? 0) as num).toDouble();

    if (plan.validityMonthly == true || monthlyPrice > 0) durations.add((1, '1 month'));
    if (plan.validityQuarterly == true || quarterlyPrice > 0) durations.add((3, '3 months'));
    if (plan.validityHalfYearly == true || halfYearlyPrice > 0) durations.add((6, '6 months'));
    if (plan.validityYearly == true || yearlyPrice > 0) durations.add((12, '12 months'));
    if (durations.isEmpty) {
      durations.add((1, '1 month'));
    }
    return durations;
  }

  double _priceForDuration(dynamic plan, int months) {
    if (plan == null) return 0;
    final monthlyPrice = ((plan.monthlyPrice ?? 0) as num).toDouble();
    final quarterlyPrice = ((plan.quarterlyPrice ?? 0) as num).toDouble();
    final halfYearlyPrice = ((plan.halfYearlyPrice ?? 0) as num).toDouble();
    final yearlyPrice = ((plan.yearlyPrice ?? 0) as num).toDouble();
    switch (months) {
      case 12:
        return yearlyPrice > 0 ? yearlyPrice : monthlyPrice * 12;
      case 6:
        return halfYearlyPrice > 0 ? halfYearlyPrice : monthlyPrice * 6;
      case 3:
        return quarterlyPrice > 0 ? quarterlyPrice : monthlyPrice * 3;
      default:
        return monthlyPrice;
    }
  }

  double _bookingAmountFor(dynamic plan) {
    if (plan == null) return 0;
    final recurring = _priceForDuration(plan, _selectedDurationMonths);
    final setup = ((plan.otcCharge ?? 0) as num).toDouble() + ((plan.installationCharge ?? 0) as num).toDouble();
    return recurring + setup;
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return AppCard(
      color: const Color(0xFFFFFFFF),
      borderColor: const Color(0x228224E3),
      textColor: const Color(0xFF131313),
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: Color(0xFF131313))),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController controller, {int maxLines = 1, TextInputType keyboardType = TextInputType.text}) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      style: const TextStyle(color: Color(0xFF131313)),
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: const Color(0xFFFFFFFF),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: Color(0x228224E3)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: Color(0x228224E3)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: Color(0x668224E3)),
        ),
      ),
    );
  }

  Widget _planTile({
    required String planName,
    required String speed,
    required String upload,
    required String data,
    required String price,
    required bool selected,
    required VoidCallback onSelect,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF8224E3), Color(0xFF9B51E0)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: selected ? const Color(0xFF8224E3) : const Color(0x228224E3), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(price, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: Color(0xFF131313))),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _summaryPill(speed, 'Speed')),
              Expanded(child: _summaryPill(upload, 'Upload')),
              Expanded(child: _summaryPill(data, 'Data')),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: Text(planName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: Color(0xFF131313)))),
              OutlinedButton(
                onPressed: onSelect,
                style: OutlinedButton.styleFrom(
                  foregroundColor: selected ? const Color(0xFF8224E3) : const Color(0xFF131313),
                  backgroundColor: selected ? const Color(0xFFF1E8FF) : const Color(0xFFFFFFFF),
                  side: BorderSide(color: selected ? const Color(0x668224E3) : const Color(0x228224E3)),
                ),
                child: Text(selected ? 'Selected' : 'Select Plan'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _durationTile({
    required String label,
    required double recurringAmount,
    required double setupAmount,
    required bool selected,
    required VoidCallback onSelect,
  }) {
    final payableNow = recurringAmount + setupAmount;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: selected
            ? const LinearGradient(
                colors: [Color(0xFF8224E3), Color(0xFF9B51E0)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        color: selected ? null : const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: selected ? const Color(0xFF8224E3) : const Color(0x228224E3), width: selected ? 1.5 : 1),
        boxShadow: selected
            ? const [BoxShadow(color: Color(0x208224E3), blurRadius: 22, offset: Offset(0, 10))]
            : const [BoxShadow(color: Color(0x0F000000), blurRadius: 10, offset: Offset(0, 6))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 22,
                    color: selected ? const Color(0xFFFFFFFF) : const Color(0xFF131313),
                  ),
                ),
              ),
              FilledButton.tonal(
                onPressed: onSelect,
                style: FilledButton.styleFrom(
                  foregroundColor: selected ? const Color(0xFF8224E3) : const Color(0xFF131313),
                  backgroundColor: const Color(0xFFFFFFFF),
                  elevation: 0,
                ),
                child: Text(selected ? 'Selected' : 'Choose'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: selected ? const Color(0x14FFFFFF) : const Color(0xFFF8F4FF),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: selected ? const Color(0x33FFFFFF) : const Color(0x228224E3)),
            ),
            child: Column(
              children: [
                _durationSummaryRow('Plan amount', 'Rs ${recurringAmount.toStringAsFixed(0)}', selected),
                const SizedBox(height: 8),
                _durationSummaryRow('Setup charges', 'Rs ${setupAmount.toStringAsFixed(0)}', selected),
                const SizedBox(height: 8),
                _durationSummaryRow('Payable now', 'Rs ${payableNow.toStringAsFixed(0)}', selected, emphasize: true),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _durationSummaryRow(String label, String value, bool selected, {bool emphasize = false}) {
    final color = selected ? const Color(0xFFFFFFFF) : const Color(0xFF131313);
    final muted = selected ? const Color(0xFFE9D5FF) : const Color(0xFF6E6A67);
    return Row(
      children: [
        Expanded(child: Text(label, style: TextStyle(color: muted, fontWeight: emphasize ? FontWeight.w700 : FontWeight.w500))),
        Text(
          value,
          style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: emphasize ? 16 : 14),
        ),
      ],
    );
  }

  Widget _summaryPill(String value, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313))),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Color(0xFF6E6A67))),
      ],
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6E6A67))),
          const Spacer(),
          Flexible(child: Text(value, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF131313)))),
        ],
      ),
    );
  }
}

class _MapHint extends StatelessWidget {
  const _MapHint();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF).withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x338224E3)),
      ),
      child: const Text(
        'Tap map to drop the exact install pin. This live lat/lng will be saved for installer allocation.',
        style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF131313)),
      ),
    );
  }
}






