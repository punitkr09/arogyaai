from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app.db_models import (
    Product,
    Warehouse,
    BatchInventory,
    StockMovement,
    Customer,
    Dispatch,
    Supplier,
    PurchaseOrder,
    TemperatureLog,
    Incident,
    AgentRun,
    AgentEvent,
    ActionProposal,
    ApprovalDecision,
)


def seed_database(db: Session = None):
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)

    # Lightweight migration check for SQLite
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            cursor = conn.execute(text("PRAGMA table_info(agent_runs)"))
            cols = [row[1] for row in cursor.fetchall()]
            if cols and "intent_json" not in cols:
                conn.execute(text("ALTER TABLE agent_runs ADD COLUMN intent_json JSON"))
                conn.commit()

            cursor = conn.execute(text("PRAGMA table_info(customers)"))
            cols = [row[1] for row in cursor.fetchall()]
            if cols and "priority_tier" not in cols:
                conn.execute(text("ALTER TABLE customers ADD COLUMN priority_tier INTEGER DEFAULT 2"))
                conn.commit()
    except Exception:
        pass

    close_session = False
    if db is None:
        db = SessionLocal()
        close_session = True

    try:
        # Check if already seeded with Batch B2231
        existing_batch = db.query(BatchInventory).filter_by(batch_number="B2231").first()
        if existing_batch:
            return  # Already seeded

        now = datetime.now(timezone.utc)

        # -------------------------------------------------------------------
        # 1. Warehouses
        # -------------------------------------------------------------------
        wh_central = Warehouse(
            code="WH-CENTRAL",
            name="Central Pharmaceutical Depot",
            location="Bhiwandi Logistics Hub, Zone A",
            cold_storage_available=False,
        )
        wh_north = Warehouse(
            code="WH-NORTH",
            name="North Cold Logistics Facility",
            location="NCR Industrial Corridor, Bay 4",
            cold_storage_available=True,
        )
        wh_west = Warehouse(
            code="WH-WEST",
            name="West Coast Express Warehouse",
            location="Pune Express Pharma Park",
            cold_storage_available=False,
        )
        db.add_all([wh_central, wh_north, wh_west])
        db.flush()

        # -------------------------------------------------------------------
        # 2. Suppliers
        # -------------------------------------------------------------------
        sup_cipla = Supplier(
            name="Cipla Direct Formulations",
            contact_email="supply-chain@cipla-partner.com",
            phone="+91-22-2495-8000",
            lead_time_days=14,
            min_order_quantity=500,
            return_window_days=60,
        )
        sup_sun = Supplier(
            name="Sun Pharma Direct Distribution",
            contact_email="orders@sunpharma-logistics.com",
            phone="+91-22-4324-4324",
            lead_time_days=10,
            min_order_quantity=300,
            return_window_days=60,
        )
        sup_biocon = Supplier(
            name="Biocon Biologics Distribution",
            contact_email="coldchain-supply@biocon.com",
            phone="+91-80-2808-2808",
            lead_time_days=21,
            min_order_quantity=200,
            return_window_days=45,
        )
        db.add_all([sup_cipla, sup_sun, sup_biocon])
        db.flush()

        # -------------------------------------------------------------------
        # 3. Products
        # -------------------------------------------------------------------
        # Primary Recall Product (Antibiotic)
        prod_amx = Product(
            sku="MED-AMX-625",
            name="Amoxicillin and Clavulanate Potassium Tablets IP 625mg",
            molecule="Amoxicillin (500mg) + Clavulanic Acid (125mg)",
            brand="Augmax-625",
            category="Antibiotic",
            storage_range="15°C - 25°C",
            is_critical=True,
            unit_price=18.50,
            unit_of_measure="strip",
            min_safety_stock=250,
        )
        # Expiry Risk Product
        prod_cef = Product(
            sku="MED-CEF-1000",
            name="Ceftriaxone Sodium Injection IP 1g",
            molecule="Ceftriaxone Sodium Sterile",
            brand="Monoceft-1g",
            category="Antibiotic",
            storage_range="15°C - 25°C",
            is_critical=True,
            unit_price=55.00,
            unit_of_measure="vial",
            min_safety_stock=150,
        )
        # Cold Chain Excursion Product
        prod_ins = Product(
            sku="MED-INS-100",
            name="Insulin Glargine Injection 100 IU/ml (3ml Cartridge)",
            molecule="Insulin Glargine Recombinant",
            brand="Glaritus PenCart",
            category="Biological",
            storage_range="2°C - 8°C",
            is_critical=True,
            unit_price=340.00,
            unit_of_measure="cartridge",
            min_safety_stock=100,
        )
        # Shortage Risk Product
        prod_mer = Product(
            sku="MED-MER-1000",
            name="Meropenem for Injection IP 1g IV",
            molecule="Meropenem Trihydrate",
            brand="Meronext-1g",
            category="Critical Care",
            storage_range="15°C - 25°C",
            is_critical=True,
            unit_price=820.00,
            unit_of_measure="vial",
            min_safety_stock=200,
        )
        # Stable Catalog Products
        prod_pcm = Product(
            sku="MED-PCM-650",
            name="Paracetamol Tablets IP 650mg",
            molecule="Paracetamol",
            brand="Dolo-650",
            category="Analgesic",
            storage_range="15°C - 30°C",
            is_critical=False,
            unit_price=3.20,
            unit_of_measure="strip",
            min_safety_stock=500,
        )
        prod_pan = Product(
            sku="MED-PAN-040",
            name="Pantoprazole Gastro-Resistant Tablets IP 40mg",
            molecule="Pantoprazole Sodium",
            brand="Pan-40",
            category="Gastrointestinal",
            storage_range="15°C - 25°C",
            is_critical=False,
            unit_price=9.50,
            unit_of_measure="strip",
            min_safety_stock=300,
        )
        db.add_all([prod_amx, prod_cef, prod_ins, prod_mer, prod_pcm, prod_pan])
        db.flush()

        # -------------------------------------------------------------------
        # 4. Batches
        # -------------------------------------------------------------------
        # B2231 - Recalled Batch: 180 remaining in warehouse, 640 dispatched
        batch_b2231 = BatchInventory(
            batch_number="B2231",
            product_id=prod_amx.id,
            warehouse_id=wh_central.id,
            available_quantity=180,
            initial_quantity=1000,
            manufacturing_date=now - timedelta(days=120),
            expiry_date=now + timedelta(days=365),
            status="active",  # active until agent places dispatch hold
            storage_condition="Controlled Room Temp (15-25°C)",
        )
        # B2240 - Replacement candidate: 400 available units, NOT recalled
        batch_b2240 = BatchInventory(
            batch_number="B2240",
            product_id=prod_amx.id,
            warehouse_id=wh_central.id,
            available_quantity=400,
            initial_quantity=500,
            manufacturing_date=now - timedelta(days=45),
            expiry_date=now + timedelta(days=540),
            status="active",
            storage_condition="Controlled Room Temp (15-25°C)",
        )
        # B1982 - Expiry Risk Batch: 350 units expiring in 35 days
        batch_b1982 = BatchInventory(
            batch_number="B1982",
            product_id=prod_cef.id,
            warehouse_id=wh_central.id,
            available_quantity=350,
            initial_quantity=600,
            manufacturing_date=now - timedelta(days=500),
            expiry_date=now + timedelta(days=35),
            status="active",
            storage_condition="Controlled Room Temp (15-25°C)",
        )
        # B4019 - Cold Chain Excursion: 500 units in North Cold Room 2
        batch_b4019 = BatchInventory(
            batch_number="B4019",
            product_id=prod_ins.id,
            warehouse_id=wh_north.id,
            available_quantity=500,
            initial_quantity=500,
            manufacturing_date=now - timedelta(days=60),
            expiry_date=now + timedelta(days=300),
            status="active",
            storage_condition="Cold Chain (2°C - 8°C)",
        )
        # B3102 - Shortage Risk: only 45 units remaining
        batch_b3102 = BatchInventory(
            batch_number="B3102",
            product_id=prod_mer.id,
            warehouse_id=wh_central.id,
            available_quantity=45,
            initial_quantity=400,
            manufacturing_date=now - timedelta(days=90),
            expiry_date=now + timedelta(days=450),
            status="active",
            storage_condition="Controlled Room Temp (15-25°C)",
        )
        # Stable Batches
        batch_pcm = BatchInventory(
            batch_number="B5011",
            product_id=prod_pcm.id,
            warehouse_id=wh_west.id,
            available_quantity=1200,
            initial_quantity=1500,
            manufacturing_date=now - timedelta(days=30),
            expiry_date=now + timedelta(days=700),
            status="active",
            storage_condition="Controlled Room Temp (15-30°C)",
        )
        batch_pan = BatchInventory(
            batch_number="B7033",
            product_id=prod_pan.id,
            warehouse_id=wh_central.id,
            available_quantity=850,
            initial_quantity=1000,
            manufacturing_date=now - timedelta(days=60),
            expiry_date=now + timedelta(days=600),
            status="active",
            storage_condition="Controlled Room Temp (15-25°C)",
        )

        db.add_all([batch_b2231, batch_b2240, batch_b1982, batch_b4019, batch_b3102, batch_pcm, batch_pan])
        db.flush()

        # -------------------------------------------------------------------
        # 5. Customers (EXACTLY 2 Hospitals + 23 Chemists = 25 distinct)
        # -------------------------------------------------------------------
        hospitals_data = [
            ("CUST-HOSP-01", "Apollo City Hospital", "Bandra West, Mumbai", "apollo.pharmacy@hospital.org", "+91-22-2604-1000", 85),
            ("CUST-HOSP-02", "St. Jude Memorial Hospital", "Mahim, Mumbai", "procurement@stjudes.org", "+91-22-2445-2000", 65),
        ]

        chemists_data = [
            ("CUST-CH-01", "Apollo Pharmacy - Bandra West", "Hill Road, Bandra West", 30),
            ("CUST-CH-02", "MedPlus Chemist - Andheri East", "Chakala, Andheri East", 25),
            ("CUST-CH-03", "Wellness Forever - Powai", "Hiranandani Gardens, Powai", 35),
            ("CUST-CH-04", "Noble Chemists - Dadar", "Pritam Hotel Chowk, Dadar T.T.", 20),
            ("CUST-CH-05", "Sanjivani Medicos - Thane", "Gokhale Road, Naupada, Thane", 25),
            ("CUST-CH-06", "Relief Pharmacy - Borivali", "Shimpoli Road, Borivali West", 20),
            ("CUST-CH-07", "Metro Chemist - Kurla", "LBS Marg, Kurla West", 15),
            ("CUST-CH-08", "LifeCare Druggists - Mulund", "MG Road, Mulund West", 30),
            ("CUST-CH-09", "Global Pharma - Ghatkopar", "R-City Mall Outer, Ghatkopar", 20),
            ("CUST-CH-10", "New Bharat Pharmacy - Chembur", "Sion-Trombay Rd, Chembur", 25),
            ("CUST-CH-11", "Sterling Medistore - Malad", "SV Road, Malad West", 15),
            ("CUST-CH-12", "Prime Care Chemists - Kandivali", "MG Road, Kandivali West", 20),
            ("CUST-CH-13", "Janata Aushadhi Kendra - Vashi", "Sector 17, Vashi, Navi Mumbai", 25),
            ("CUST-CH-14", "Care & Cure Pharmacy - Nerul", "Sector 21, Nerul", 20),
            ("CUST-CH-15", "Guardian Pharmacy - Goregaon", "Aarey Road, Goregaon East", 15),
            ("CUST-CH-16", "Apex Druggists - Santacruz", "Tagore Road, Santacruz West", 20),
            ("CUST-CH-17", "Trust Medical Store - Sion", "Sion Circle, Sion", 25),
            ("CUST-CH-18", "National Chemist - Byculla", "Dr. Ambedkar Rd, Byculla", 15),
            ("CUST-CH-19", "Suburban Pharma - Vile Parle", "Nehru Road, Vile Parle East", 20),
            ("CUST-CH-20", "Green Cross Chemist - Bhandup", "LBS Marg, Bhandup West", 20),
            ("CUST-CH-21", "Sai Krupa Medicos - Dombivli", "Manpada Road, Dombivli East", 25),
            ("CUST-CH-22", "Universal Pharmacy - Kalyan", "Station Road, Kalyan West", 15),
            ("CUST-CH-23", "Aura Health Druggists - Panvel", "Old Panvel Market, Panvel", 10),
        ]

        # Verification check: 85 + 65 + sum(quantities) == 640
        chem_sum = sum(item[3] for item in chemists_data)
        hosp_sum = 85 + 65
        assert hosp_sum + chem_sum == 640, f"Dispatched total mismatch: {hosp_sum + chem_sum}"

        customer_objects = []
        dispatch_objects = []

        disp_idx = 1
        # Add hospitals
        for code, name, address, email, phone, qty in hospitals_data:
            cust = Customer(
                code=code,
                name=name,
                customer_type="hospital",
                contact_email=email,
                phone=phone,
                address=address,
                license_number=f"MH-HOSP-2024-{disp_idx:03d}",
                compliance_verified=True,
            )
            customer_objects.append(cust)
            db.add(cust)
            db.flush()

            disp = Dispatch(
                dispatch_number=f"DSP-B2231-{disp_idx:03d}",
                customer_id=cust.id,
                batch_id=batch_b2231.id,
                product_id=prod_amx.id,
                quantity=qty,
                dispatch_date=now - timedelta(days=28 - disp_idx),
                status="delivered",
                tracking_ref=f"TRK-APO-{disp_idx:04d}",
            )
            dispatch_objects.append(disp)
            disp_idx += 1

        # Add chemists
        for code, name, address, qty in chemists_data:
            cust = Customer(
                code=code,
                name=name,
                customer_type="chemist",
                contact_email=f"contact@{code.lower()}.pharma.in",
                phone=f"+91-98200-{disp_idx:05d}",
                address=address,
                license_number=f"MH-RET-2023-{disp_idx:03d}",
                compliance_verified=True,
            )
            customer_objects.append(cust)
            db.add(cust)
            db.flush()

            disp = Dispatch(
                dispatch_number=f"DSP-B2231-{disp_idx:03d}",
                customer_id=cust.id,
                batch_id=batch_b2231.id,
                product_id=prod_amx.id,
                quantity=qty,
                dispatch_date=now - timedelta(days=25 - (disp_idx % 20)),
                status="delivered",
                tracking_ref=f"TRK-RET-{disp_idx:04d}",
            )
            dispatch_objects.append(disp)
            disp_idx += 1

        db.add_all(dispatch_objects)
        db.flush()

        # -------------------------------------------------------------------
        # 6. Stock Movements for Batch B2231
        # -------------------------------------------------------------------
        # Receipt: 1000 units
        # Dispatches: 640 units
        # Testing & retention samples: 180 remaining in warehouse (1000 - 640 - 180 = 180)
        # Note: prompt states: "the 640 dispatched units and 180 remaining units are separate quantities.
        # Do not assume they exhaust the original batch unless the complete inventory history establishes that fact."
        mov_receipt = StockMovement(
            batch_id=batch_b2231.id,
            movement_type="receipt",
            quantity=1000,
            reference_doc="GRN-2026-CIP-8821",
            timestamp=now - timedelta(days=120),
            notes="Initial receipt from Cipla Direct. Passed incoming QC inspection.",
        )
        mov_disp = StockMovement(
            batch_id=batch_b2231.id,
            movement_type="dispatch",
            quantity=-640,
            reference_doc="BATCH-OUTWARD-SUMMARY-30D",
            timestamp=now - timedelta(days=15),
            notes="Aggregated outward dispatch to 23 chemists and 2 hospitals over past 30 days.",
        )
        mov_qc_hold = StockMovement(
            batch_id=batch_b2231.id,
            movement_type="retention_sample",
            quantity=-180,
            reference_doc="WH-RESERVE-CHECK-01",
            timestamp=now - timedelta(days=5),
            notes="180 units held in Central Depot Bin C-14. Reconciliation shows 180 units physical balance on hand.",
        )
        db.add_all([mov_receipt, mov_disp, mov_qc_hold])

        # Stock Movements for B2240 (Replacement Batch)
        mov_b2240 = StockMovement(
            batch_id=batch_b2240.id,
            movement_type="receipt",
            quantity=500,
            reference_doc="GRN-2026-CIP-9104",
            timestamp=now - timedelta(days=45),
            notes="Received fresh batch. 100 units dispatched to regional clinics, 400 available in stock.",
        )
        db.add(mov_b2240)

        # -------------------------------------------------------------------
        # 7. Temperature Logs (Cold Chain Excursion)
        # -------------------------------------------------------------------
        temp_log_normal = TemperatureLog(
            warehouse_id=wh_north.id,
            cold_room_unit="Cold Room Unit 2",
            recorded_at=now - timedelta(hours=12),
            temperature_celsius=4.2,
            is_excursion=False,
            duration_minutes=0,
            alert_sent=False,
        )
        temp_log_excursion = TemperatureLog(
            warehouse_id=wh_north.id,
            cold_room_unit="Cold Room Unit 2",
            recorded_at=now - timedelta(hours=6),
            temperature_celsius=12.8,
            is_excursion=True,
            duration_minutes=270,  # 4.5 hours
            alert_sent=True,
        )
        temp_log_recovery = TemperatureLog(
            warehouse_id=wh_north.id,
            cold_room_unit="Cold Room Unit 2",
            recorded_at=now - timedelta(hours=1),
            temperature_celsius=4.8,
            is_excursion=False,
            duration_minutes=0,
            alert_sent=False,
        )
        db.add_all([temp_log_normal, temp_log_excursion, temp_log_recovery])

        # -------------------------------------------------------------------
        # 8. Demo Incidents
        # -------------------------------------------------------------------
        inc_recall = Incident(
            incident_number="INC-2026-RECALL-01",
            title="Recall Notice: Antibiotic Batch B2231 Discoloration Alert",
            incident_type="recall",
            severity="critical",
            affected_batch_number="B2231",
            status="open",
            details_json=(
                '{"reason": "Manufacturer Class II Recall Notice: potential particulate discoloration in tablet coating", '
                '"originator": "National Drugs Regulatory Authority / Cipla Quality Control", '
                '"target_batch": "B2231", "product": "Amoxicillin and Clavulanate 625mg", '
                '"action_required": "Immediate dispatch freeze, recipient trace, replacement allocation and quarantine"}'
            ),
            created_at=now - timedelta(hours=2),
        )
        inc_expiry = Incident(
            incident_number="INC-2026-EXPIRY-02",
            title="Impending Expiry: Ceftriaxone Batch B1982 Return Window Expiration",
            incident_type="expiry_risk",
            severity="high",
            affected_batch_number="B1982",
            status="open",
            details_json=(
                '{"reason": "350 units expiring within 35 days. Projected sales rate 45 units/mo leaves 298 units at risk of expiration.", '
                '"supplier": "Sun Pharma Direct Distribution", "return_policy": "60 days prior to expiry return credit eligible"}'
            ),
            created_at=now - timedelta(hours=5),
        )
        inc_cold = Incident(
            incident_number="INC-2026-COLD-03",
            title="Cold-Chain Thermal Excursion: North Cold Room 2 (Insulin Glargine)",
            incident_type="temperature_excursion",
            severity="critical",
            affected_batch_number="B4019",
            status="open",
            details_json=(
                '{"reason": "Temperature spiked to 12.8°C for 4.5 hours exceeding 2-8°C limit. Compressor failure in Unit 2.", '
                '"affected_stock": 500, "product": "Insulin Glargine 100 IU/ml"}'
            ),
            created_at=now - timedelta(hours=6),
        )
        inc_short = Incident(
            incident_number="INC-2026-SHORT-04",
            title="Critical Stock Shortage: Meropenem 1g IV Below Safety Threshold",
            incident_type="shortage",
            severity="high",
            affected_batch_number="B3102",
            status="open",
            details_json=(
                '{"reason": "Critical ICU antibiotic stock at 45 units. Safety minimum is 200 units. Depletion forecast in 3.75 days.", '
                '"product": "Meropenem 1g IV"}'
            ),
            created_at=now - timedelta(hours=8),
        )
        db.add_all([inc_recall, inc_expiry, inc_cold, inc_short])

        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        if close_session:
            db.close()


def reset_database(include_datasets: bool = False):
    """Drops all tables and re-seeds cleanly."""
    engine.dispose()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_database()
    if include_datasets:
        try:
            import sys
            from pathlib import Path
            backend_dir = Path(__file__).resolve().parent.parent
            if str(backend_dir / "scripts") not in sys.path:
                sys.path.insert(0, str(backend_dir / "scripts"))
            from import_datasets import import_all_datasets
            db = SessionLocal()
            try:
                import_all_datasets(db)
            finally:
                db.close()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Dataset auto-sync on reset: {e}")
