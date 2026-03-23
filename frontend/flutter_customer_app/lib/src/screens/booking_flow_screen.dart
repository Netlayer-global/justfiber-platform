import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
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
  String? _selectedSlotCode = 'morning';
  String? _selectedSlotLabel = '10 AM - 1 PM';
  DateTime _preferredDate = DateTime.now().add(const Duration(days: 1));
  LatLng _selectedLocation = const LatLng(28.6139, 77.2090);
  bool _hasPickedLocation = false;
  bool _locationBusy = false;
  String? _locationError;
  final nameController = TextEditingController();
  final mobileController = TextEditingController();
  final addressController = TextEditingController();
  final pinController = TextEditingController();

  @override
  void dispose() {
    nameController.dispose();
    mobileController.dispose();
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
        backgroundColor: const Color(0xFF0C1018),
        foregroundColor: const Color(0xFFEFEEE8),
      ),
      backgroundColor: const Color(0xFF0C1018),
      body: RefreshIndicator(
        color: const Color(0xFFE6FF3C),
        backgroundColor: const Color(0xFF0C1018),
        onRefresh: appState.refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
          children: [
          _heroBanner(),
          const SizedBox(height: 18),
          _stepper(),
          const SizedBox(height: 20),
          if (step == 0) _addressStep(appState),
          if (step == 1) _planStep(appState, plans),
          if (step == 2) _bookingStep(appState, plans),
          if (step == 3 && latestBooking != null) _successStep(latestBooking),
          ],
        ),
      ),
    );
  }

  Widget _addressStep(AppState appState) {
    final feasibility = appState.feasibility;
    return _sectionCard(
      title: 'Confirm service address',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Unlock plans and offers available in your area.', style: TextStyle(color: Color(0xFF6B7280), height: 1.4)),
          const SizedBox(height: 16),
          _field('Full name', nameController),
          const SizedBox(height: 12),
          _field('Mobile number', mobileController, keyboardType: TextInputType.phone),
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
                    backgroundColor: const Color(0xFF0E1520),
                    foregroundColor: const Color(0xFFEFEEE8),
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
              border: Border.all(color: const Color(0x33E6FF3C)),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                FlutterMap(
                  options: MapOptions(
                    initialCenter: _selectedLocation,
                    initialZoom: 16,
                    onTap: (_, point) {
                      setState(() {
                        _selectedLocation = point;
                        _hasPickedLocation = true;
                        _locationError = null;
                      });
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
          if ((_locationError ?? '').isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(_locationError!, style: const TextStyle(color: Color(0xFFB91C1C), fontWeight: FontWeight.w700)),
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
                  color: feasibility.feasible ? const Color(0x66E6FF3C) : const Color(0x66EF4444),
                ),
              ),
              child: Text(
                feasibility.message,
                style: TextStyle(
                  color: feasibility.feasible ? const Color(0xFFE6FF3C) : const Color(0xFFFCA5A5),
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
                        setState(() => step = 1);
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(appState.bookingError ?? 'Service is not available at this address yet.')),
                        );
                      }
                    },
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE6FF3C), foregroundColor: const Color(0xFF031B17)),
              child: Text(appState.bookingBusy ? 'Checking...' : 'Confirm & View Plans'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _planStep(AppState appState, List<dynamic> plans) {
    return _sectionCard(
      title: 'Popular plans',
      child: Column(
        children: [
          for (final plan in plans)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _planTile(
                planName: plan.name,
                speed: '${plan.speedMbps.toStringAsFixed(0)} Mbps',
                price: 'Rs ${plan.monthlyPrice.toStringAsFixed(0)} /m + GST',
                selected: selectedPlanCode == plan.planCode,
                onSelect: () => setState(() => selectedPlanCode = plan.planCode),
              ),
            ),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: selectedPlanCode == null ? null : () => setState(() => step = 2),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFE6FF3C),
                foregroundColor: const Color(0xFF111111),
              ),
              child: const Text('Continue to Booking'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bookingStep(AppState appState, List<dynamic> plans) {
    dynamic selected;
    for (final item in plans) {
      if (item.planCode == selectedPlanCode) {
        selected = item;
        break;
      }
    }

    return _sectionCard(
      title: 'Book installation',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'We will create the booking and assign the installation team. Slot confirmation can follow from support or installer assignment.',
            style: TextStyle(color: Color(0xFF6B7280), height: 1.45),
          ),
          const SizedBox(height: 16),
          _summaryRow('Customer', nameController.text.trim().isEmpty ? '-' : nameController.text.trim()),
          _summaryRow('Address', addressController.text.trim().isEmpty ? '-' : addressController.text.trim()),
          _summaryRow('Pin code', pinController.text.trim().isEmpty ? '-' : pinController.text.trim()),
          _summaryRow('Pinned coordinates', '${_selectedLocation.latitude.toStringAsFixed(6)}, ${_selectedLocation.longitude.toStringAsFixed(6)}'),
          _summaryRow('Plan', selected?.name ?? '-'),
          _summaryRow('Preferred date', _formatDate(_preferredDate)),
          _summaryRow('Preferred slot', _selectedSlotLabel ?? '-'),
          const SizedBox(height: 16),
          const Text('Preferred install date', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
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
                  backgroundColor: const Color(0xFF10151A),
                  selectedColor: const Color(0xFFE6FF3C),
                  side: BorderSide(color: selectedDate ? const Color(0xFFE6FF3C) : const Color(0x22E6FF3C)),
                  labelStyle: TextStyle(
                    color: selectedDate ? const Color(0xFF111111) : const Color(0xFFEFEEE8),
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
          const Text('Preferred install slot', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: _slotOptions.map((slot) {
              final selectedSlot = _selectedSlotCode == slot.$1;
              return ChoiceChip(
                label: Text(slot.$2),
                selected: selectedSlot,
                backgroundColor: const Color(0xFF10151A),
                selectedColor: const Color(0xFFE6FF3C),
                side: BorderSide(color: selectedSlot ? const Color(0xFFE6FF3C) : const Color(0x22E6FF3C)),
                labelStyle: TextStyle(
                  color: selectedSlot ? const Color(0xFF111111) : const Color(0xFFEFEEE8),
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
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: appState.bookingBusy
                  ? null
                  : () async {
                      final ok = await appState.createBooking(
                        planCode: selectedPlanCode!,
                        fullName: nameController.text.trim(),
                        mobile: mobileController.text.trim(),
                        address: addressController.text.trim(),
                        pinCode: pinController.text.trim(),
                        lat: _selectedLocation.latitude,
                        lng: _selectedLocation.longitude,
                        preferredDate: _preferredDate.toIso8601String(),
                        preferredSlotCode: _selectedSlotCode,
                        preferredSlotLabel: _selectedSlotLabel,
                      );
                      if (!mounted) return;
                      if (ok) {
                        await appState.refresh();
                        if (!mounted) return;
                        setState(() => step = 3);
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(appState.bookingError ?? 'Unable to create booking')),
                        );
                      }
                    },
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE6FF3C), foregroundColor: const Color(0xFF031B17)),
              child: Text(appState.bookingBusy ? 'Booking...' : 'Create Booking'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _successStep(dynamic latestBooking) {
    return _sectionCard(
      title: 'Booking created',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0B0F19), Color(0xFF111827)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              'Booking ${latestBooking.bookingNumber} is ${latestBooking.status}.',
              style: const TextStyle(color: Color(0xFFE6FF3C), fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(height: 16),
          _summaryRow('Plan', latestBooking.planName),
          _summaryRow('Amount', 'Rs ${latestBooking.amount.toStringAsFixed(0)}'),
          _summaryRow('Current step', latestBooking.currentStep),
          _summaryRow('Preferred date', _formatDate(_preferredDate)),
          _summaryRow('Preferred slot', _selectedSlotLabel ?? '-'),
          _summaryRow('Install address', addressController.text.trim().isEmpty ? '-' : addressController.text.trim()),
          _summaryRow('Pin code', pinController.text.trim().isEmpty ? '-' : pinController.text.trim()),
          _summaryRow('Map pin', '${_selectedLocation.latitude.toStringAsFixed(6)}, ${_selectedLocation.longitude.toStringAsFixed(6)}'),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF0C1018),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0x22E6FF3C)),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('What happens next?', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFFEFEEE8))),
                SizedBox(height: 8),
                Text('1. Operations and installer teams can now see this booking.', style: TextStyle(color: Color(0xFFD1D5DB))),
                SizedBox(height: 4),
                Text('2. The exact map pin and preferred install slot are attached to the job.', style: TextStyle(color: Color(0xFFD1D5DB))),
                SizedBox(height: 4),
                Text('3. You can track updates from the booking and service tracking screen.', style: TextStyle(color: Color(0xFFD1D5DB))),
              ],
            ),
          ),
          const SizedBox(height: 16),
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
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE6FF3C), foregroundColor: const Color(0xFF111111)),
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
        ],
      ),
    );
  }

  Widget _heroBanner() {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF090D15), Color(0xFF111827)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: const Color(0x22E6FF3C)),
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
                          color: const Color(0xFF9CA3AF),
                          letterSpacing: 3.2,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 10),
                  const Text('Book new Wi-Fi', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Color(0xFFE6FF3C))),
                  const SizedBox(height: 6),
                  const Text('Select your plan, confirm address, and create a live booking with an exact install map pin.', style: TextStyle(color: Color(0xFFD1D5DB), height: 1.4)),
                ],
              ),
            ),
          ),
          Container(
            width: 120,
            height: 120,
            margin: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF10151A),
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: const Color(0x66E6FF3C)),
            ),
            child: const Icon(Icons.wifi_rounded, color: Color(0xFFE6FF3C), size: 56),
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
    });
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw Exception('Location services are turned off.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        throw Exception('Location permission is required to fetch current location.');
      }
      final position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() {
        _selectedLocation = LatLng(position.latitude, position.longitude);
        _hasPickedLocation = true;
      });
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

  Widget _stepper() {
    final labels = ['Address', 'Select Plan', 'Booking', 'Track'];
    return Row(
      children: List.generate(labels.length, (index) {
        final active = index <= step;
        return Expanded(
          child: Column(
            children: [
              Container(
                height: 4,
                margin: EdgeInsets.only(left: index == 0 ? 24 : 0, right: index == labels.length - 1 ? 24 : 0),
                decoration: BoxDecoration(
                  color: active ? const Color(0xFFE6FF3C) : const Color(0xFF1F2937),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                labels[index],
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: active ? const Color(0xFFEFEEE8) : const Color(0xFF6B7280),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return AppCard(
      color: const Color(0xFF0C1018),
      borderColor: const Color(0x22E6FF3C),
      textColor: const Color(0xFFEFEEE8),
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: Color(0xFFEFEEE8))),
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
      style: const TextStyle(color: Color(0xFFEFEEE8)),
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: const Color(0xFF08131B),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: Color(0x22E6FF3C)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: Color(0x22E6FF3C)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: Color(0x66E6FF3C)),
        ),
      ),
    );
  }

  Widget _planTile({
    required String planName,
    required String speed,
    required String price,
    required bool selected,
    required VoidCallback onSelect,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0C1018), Color(0xFF111827)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: selected ? const Color(0xFFE6FF3C) : const Color(0x22E6FF3C), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(price, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: Color(0xFFEFEEE8))),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _summaryPill(speed, 'Speed')),
              Expanded(child: _summaryPill('Unlimited', 'Internet')),
              Expanded(child: _summaryPill('OTT Ready', 'Benefits')),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: Text(planName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: Color(0xFFEFEEE8)))),
              OutlinedButton(
                onPressed: onSelect,
                style: OutlinedButton.styleFrom(
                  foregroundColor: selected ? const Color(0xFFE6FF3C) : const Color(0xFFEFEEE8),
                  backgroundColor: selected ? const Color(0xFF10151A) : const Color(0xFF15181C),
                  side: BorderSide(color: selected ? const Color(0x66E6FF3C) : const Color(0x22E6FF3C)),
                ),
                child: Text(selected ? 'Selected' : 'Select Plan'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryPill(String value, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFEFEEE8))),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Color(0xFF9CA3AF))),
      ],
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF9CA3AF))),
          const Spacer(),
          Flexible(child: Text(value, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFEFEEE8)))),
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
        color: const Color(0xFF08131B).withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x44E6FF3C)),
      ),
      child: const Text(
        'Tap map to drop the exact install pin. This live lat/lng will be saved for installer allocation.',
        style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFEFEEE8)),
      ),
    );
  }
}

