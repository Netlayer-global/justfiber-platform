import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/app_state.dart';
import '../core/theme.dart';

class OpticalCheckScreen extends StatefulWidget {
  const OpticalCheckScreen({super.key});

  @override
  State<OpticalCheckScreen> createState() => _OpticalCheckScreenState();
}

class _OpticalCheckScreenState extends State<OpticalCheckScreen> {
  final _searchController = TextEditingController();
  bool _searching = false;
  bool _loadingOptical = false;
  String? _error;
  List<Map<String, dynamic>> _customers = [];
  Map<String, dynamic>? _opticalData;
  String? _selectedCustomerId;
  String? _selectedCustomerName;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _searchCustomers(String query) async {
    if (query.trim().isEmpty) {
      setState(() {
        _customers = [];
        _error = null;
      });
      return;
    }
    final appState = InstallerStateScope.of(context);
    final session = appState.session;
    if (session == null) return;

    setState(() {
      _searching = true;
      _error = null;
    });

    try {
      final results = await appState.api.searchCustomers(
        session,
        query: query.trim(),
      );
      if (!mounted) return;
      setState(() {
        _customers = results;
        _searching = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = installerFriendlyError(e);
        _searching = false;
      });
    }
  }

  Future<void> _fetchOptical(String customerId, String customerName) async {
    final appState = InstallerStateScope.of(context);
    final session = appState.session;
    if (session == null) return;

    setState(() {
      _loadingOptical = true;
      _error = null;
      _opticalData = null;
      _selectedCustomerId = customerId;
      _selectedCustomerName = customerName;
    });

    try {
      final data = await appState.api.checkCustomerOptical(
        session,
        customerId: customerId,
      );
      if (!mounted) return;
      setState(() {
        _opticalData = data;
        _loadingOptical = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = installerFriendlyError(e);
        _loadingOptical = false;
      });
    }
  }

  Future<void> _refreshOptical() async {
    if (_selectedCustomerId == null || _selectedCustomerName == null) return;
    await _fetchOptical(_selectedCustomerId!, _selectedCustomerName!);
  }

  Color _rxPowerColor(double? rxPower) {
    if (rxPower == null) return kMuted;
    if (rxPower > -24) return const Color(0xFF10B981);
    if (rxPower >= -27) return const Color(0xFFFBBF24);
    return const Color(0xFFEF4444);
  }

  String _rxPowerLabel(double? rxPower) {
    if (rxPower == null) return 'Unknown';
    if (rxPower > -24) return 'Good';
    if (rxPower >= -27) return 'Marginal';
    return 'Critical';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        title: Text(
          'Optical Power Check',
          style: GoogleFonts.inter(
            color: Colors.white,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: Column(
        children: [
          // Search field
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
            child: TextField(
              controller: _searchController,
              style: GoogleFonts.inter(color: kText, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search by customer ID, phone, or name',
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          setState(() {
                            _customers = [];
                            _opticalData = null;
                            _selectedCustomerId = null;
                            _error = null;
                          });
                        },
                      )
                    : null,
              ),
              textInputAction: TextInputAction.search,
              onSubmitted: _searchCustomers,
              onChanged: (value) {
                setState(() {});
                if (value.trim().length >= 3) {
                  _searchCustomers(value);
                }
              },
            ),
          ),

          // Content area
          Expanded(
            child: _buildContent(),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    // Show optical data if we have it
    if (_opticalData != null && _selectedCustomerName != null) {
      return _buildOpticalResult();
    }

    // Show loading for optical fetch
    if (_loadingOptical) {
      return const Center(
        child: CircularProgressIndicator(color: kPrimaryLight),
      );
    }

    // Show error
    if (_error != null && _customers.isEmpty && _opticalData == null) {
      return _buildError();
    }

    // Show searching indicator
    if (_searching) {
      return const Center(
        child: CircularProgressIndicator(color: kPrimaryLight),
      );
    }

    // Show customer list
    if (_customers.isNotEmpty) {
      return _buildCustomerList();
    }

    // Empty state
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.network_check_rounded,
                color: kPrimaryLight,
                size: 32,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Check Optical Power',
              style: GoogleFonts.inter(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Search for a customer to check their ONT optical power readings.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                color: kMuted,
                fontSize: 13,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCustomerList() {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
      itemCount: _customers.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final customer = _customers[index];
        final name = (customer['fullName'] ?? customer['name'] ?? '-').toString();
        final phone = (customer['phone'] ?? customer['mobile'] ?? '').toString();
        final id = (customer['_id'] ?? customer['id'] ?? customer['customerId'] ?? '').toString();

        return GestureDetector(
          onTap: () => _fetchOptical(id, name),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kBorder),
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: kPrimary.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : '?',
                      style: GoogleFonts.inter(
                        color: kPrimaryLight,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                      if (phone.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          phone,
                          style: GoogleFonts.inter(
                            color: kMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const Icon(
                  Icons.network_check_rounded,
                  color: kSubtle,
                  size: 20,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildOpticalResult() {
    final rxPowerRaw = _opticalData!['rxPower'] ??
        _opticalData!['opticalRxPower'] ??
        _opticalData!['receivedPower'];
    final txPowerRaw = _opticalData!['txPower'] ??
        _opticalData!['opticalTxPower'] ??
        _opticalData!['transmittedPower'];
    final healthStatus = (_opticalData!['healthStatus'] ??
            _opticalData!['opticalHealth'] ??
            _opticalData!['status'] ??
            '')
        .toString();
    final lastMeasured = (_opticalData!['lastMeasuredAt'] ??
            _opticalData!['measuredAt'] ??
            _opticalData!['updatedAt'] ??
            '')
        .toString();

    final rxPower = double.tryParse('$rxPowerRaw');
    final txPower = double.tryParse('$txPowerRaw');
    final rxColor = _rxPowerColor(rxPower);
    final rxLabel = _rxPowerLabel(rxPower);

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
      children: [
        // Customer header
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: kBorder),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: kPrimary.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    _selectedCustomerName!.isNotEmpty
                        ? _selectedCustomerName![0].toUpperCase()
                        : '?',
                    style: GoogleFonts.inter(
                      color: kPrimaryLight,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _selectedCustomerName!,
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'ID: $_selectedCustomerId',
                      style: GoogleFonts.inter(
                        color: kSubtle,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: () {
                  setState(() {
                    _opticalData = null;
                    _selectedCustomerId = null;
                    _selectedCustomerName = null;
                  });
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.close_rounded,
                    color: kMuted,
                    size: 18,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // RX Power - main card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                rxColor.withValues(alpha: 0.18),
                const Color(0xFF1A112B),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: rxColor.withValues(alpha: 0.32)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.arrow_downward_rounded, color: rxColor, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'RX Power',
                    style: GoogleFonts.inter(
                      color: kMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: rxColor.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: rxColor.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      rxLabel,
                      style: GoogleFonts.inter(
                        color: rxColor,
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                rxPower != null ? '${rxPower.toStringAsFixed(1)} dBm' : 'N/A',
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 32,
                  letterSpacing: -1,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // TX Power + Health row
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: kBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.arrow_upward_rounded,
                            color: Color(0xFF0EA5E9), size: 16),
                        const SizedBox(width: 6),
                        Text(
                          'TX Power',
                          style: GoogleFonts.inter(
                            color: kMuted,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      txPower != null
                          ? '${txPower.toStringAsFixed(1)} dBm'
                          : 'N/A',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 20,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: kBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.monitor_heart_rounded,
                            color: Color(0xFF10B981), size: 16),
                        const SizedBox(width: 6),
                        Text(
                          'Health',
                          style: GoogleFonts.inter(
                            color: kMuted,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      healthStatus.isNotEmpty ? healthStatus : 'N/A',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                        letterSpacing: -0.3,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Last measured
        if (lastMeasured.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: kBorder),
            ),
            child: Row(
              children: [
                const Icon(Icons.schedule_rounded, color: kSubtle, size: 16),
                const SizedBox(width: 10),
                Text(
                  'Last measured: ${_formatTimestamp(lastMeasured)}',
                  style: GoogleFonts.inter(
                    color: kMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 20),

        // Refresh button
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _loadingOptical ? null : _refreshOptical,
            icon: _loadingOptical
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white70,
                    ),
                  )
                : const Icon(Icons.refresh_rounded, size: 18),
            label: Text(
              _loadingOptical ? 'Refreshing…' : 'Refresh Optical Data',
              style: GoogleFonts.inter(fontWeight: FontWeight.w700),
            ),
          ),
        ),

        // Error within optical view
        if (_error != null) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0x0DFF6B6B),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0x33FF6B6B)),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded,
                    color: Color(0xFFFCA5A5), size: 16),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _error!,
                    style: GoogleFonts.inter(
                      color: const Color(0xFFFCA5A5),
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded,
                color: Color(0xFFFCA5A5), size: 40),
            const SizedBox(height: 14),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                color: const Color(0xFFFCA5A5),
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 18),
            OutlinedButton(
              onPressed: () {
                setState(() => _error = null);
                if (_searchController.text.trim().isNotEmpty) {
                  _searchCustomers(_searchController.text);
                }
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTimestamp(String raw) {
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw;
    final local = dt.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$day/$month/${local.year} $hour:$minute';
  }
}
