-- SmartMove Transport Solutions  -  COMPLETE ORACLE DATABASE SCRIPT


SET SERVEROUTPUT ON;

-- 1. TABLES

-- 1.1 Core base tables ------------------------------------------------
CREATE TABLE DRIVER (
    DriverID       VARCHAR2(10)  NOT NULL,
    FullName       VARCHAR2(100) NOT NULL,
    LicenseNumber  VARCHAR2(20)  NOT NULL,
    Phone          VARCHAR2(15)  NOT NULL,
    HireDate       DATE          DEFAULT SYSDATE NOT NULL,
    Status         VARCHAR2(10)  DEFAULT 'ACTIVE' NOT NULL,
    CONSTRAINT PK_DRIVER PRIMARY KEY (DriverID),
    CONSTRAINT UQ_DRIVER_LICENSE UNIQUE (LicenseNumber),
    CONSTRAINT CHK_DRIVER_STATUS CHECK (Status IN ('ACTIVE','ON_LEAVE','INACTIVE'))
);

CREATE TABLE VEHICLE (
    VehicleID      VARCHAR2(10)  NOT NULL,
    RegistrationNo VARCHAR2(20)  NOT NULL,
    VehicleType    VARCHAR2(10)  NOT NULL,
    SeatCapacity   NUMBER(3)     NOT NULL,
    Status         VARCHAR2(20)  DEFAULT 'ACTIVE' NOT NULL,
    OwnerDriverID  VARCHAR2(10),
    CONSTRAINT PK_VEHICLE PRIMARY KEY (VehicleID),
    CONSTRAINT UQ_VEHICLE_REG UNIQUE (RegistrationNo),
    CONSTRAINT FK_VEHICLE_DRIVER FOREIGN KEY (OwnerDriverID)
        REFERENCES DRIVER(DriverID) ON DELETE SET NULL,
    CONSTRAINT CHK_VEHICLE_TYPE CHECK (VehicleType IN ('BUS','VAN')),
    CONSTRAINT CHK_VEHICLE_SEATS CHECK (SeatCapacity > 0),
    CONSTRAINT CHK_VEHICLE_STATUS CHECK (Status IN ('ACTIVE','UNDER_MAINTENANCE','RETIRED'))
);

CREATE TABLE ROUTE (
    RouteID         VARCHAR2(10)  NOT NULL,
    RouteName       VARCHAR2(100) NOT NULL,
    TotalDistanceKm NUMBER(6,2)   NOT NULL,
    CONSTRAINT PK_ROUTE PRIMARY KEY (RouteID),
    CONSTRAINT CHK_ROUTE_DIST CHECK (TotalDistanceKm > 0)
);

CREATE TABLE ROUTE_STOP (
    RouteID   VARCHAR2(10)  NOT NULL,
    StopSeqNo NUMBER(3)     NOT NULL,
    StopName  VARCHAR2(100) NOT NULL,
    CONSTRAINT PK_ROUTE_STOP PRIMARY KEY (RouteID, StopSeqNo),
    CONSTRAINT FK_STOP_ROUTE FOREIGN KEY (RouteID)
        REFERENCES ROUTE(RouteID) ON DELETE CASCADE,
    CONSTRAINT CHK_STOP_SEQ CHECK (StopSeqNo > 0)
);

CREATE TABLE PASSENGER (
    PassengerID    VARCHAR2(10)  NOT NULL,
    Name           VARCHAR2(100) NOT NULL,
    Phone          VARCHAR2(15)  NOT NULL,
    Email          VARCHAR2(100),
    PassengerType  VARCHAR2(10)  DEFAULT 'COMMUTER' NOT NULL,
    RegisteredDate DATE          DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_PASSENGER PRIMARY KEY (PassengerID),
    CONSTRAINT UQ_PASSENGER_EMAIL UNIQUE (Email),
    CONSTRAINT CHK_PASSENGER_TYPE CHECK (PassengerType IN ('COMMUTER','CORPORATE','SPECIAL'))
);

-- 1.2 Vehicle subtypes ------------------------------------------------
CREATE TABLE BUS (
    VehicleID     VARCHAR2(10)  NOT NULL,
    NumberOfDecks NUMBER(1)     DEFAULT 1 NOT NULL,
    RatePerKm     NUMBER(6,2)   NOT NULL,
    CONSTRAINT PK_BUS PRIMARY KEY (VehicleID),
    CONSTRAINT FK_BUS_VEHICLE FOREIGN KEY (VehicleID)
        REFERENCES VEHICLE(VehicleID) ON DELETE CASCADE,
    CONSTRAINT CHK_BUS_DECKS CHECK (NumberOfDecks IN (1, 2)),
    CONSTRAINT CHK_BUS_RATE CHECK (RatePerKm > 0)
);

CREATE TABLE VAN (
    VehicleID    VARCHAR2(10)  NOT NULL,
    CargoSpaceM3 NUMBER(5,2)   NOT NULL,
    RatePerKm    NUMBER(6,2)   NOT NULL,
    CONSTRAINT PK_VAN PRIMARY KEY (VehicleID),
    CONSTRAINT FK_VAN_VEHICLE FOREIGN KEY (VehicleID)
        REFERENCES VEHICLE(VehicleID) ON DELETE CASCADE,
    CONSTRAINT CHK_VAN_CARGO CHECK (CargoSpaceM3 >= 0),
    CONSTRAINT CHK_VAN_RATE CHECK (RatePerKm > 0)
);

-- 1.3 Trip supertype and subtypes -------------------------------------
-- TripDate holds both the date and the departure time.
CREATE TABLE TRIP (
    TripID    VARCHAR2(10) NOT NULL,
    TripDate  DATE         NOT NULL,
    DriverID  VARCHAR2(10) NOT NULL,
    VehicleID VARCHAR2(10) NOT NULL,
    Status    VARCHAR2(12) DEFAULT 'SCHEDULED' NOT NULL,
    CONSTRAINT PK_TRIP PRIMARY KEY (TripID),
    CONSTRAINT FK_TRIP_DRIVER FOREIGN KEY (DriverID) REFERENCES DRIVER(DriverID),
    CONSTRAINT FK_TRIP_VEHICLE FOREIGN KEY (VehicleID) REFERENCES VEHICLE(VehicleID),
    CONSTRAINT UQ_TRIP_DRIVER_TIME UNIQUE (DriverID, TripDate),
    CONSTRAINT UQ_TRIP_VEHICLE_TIME UNIQUE (VehicleID, TripDate),
    CONSTRAINT CHK_TRIP_STATUS CHECK (Status IN ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'))
);

CREATE TABLE STAFF_SERVICE_TRIP (
    TripID  VARCHAR2(10) NOT NULL,
    RouteID VARCHAR2(10) NOT NULL,
    CONSTRAINT PK_STAFF_SERVICE_TRIP PRIMARY KEY (TripID),
    CONSTRAINT FK_SSTRIP_TRIP FOREIGN KEY (TripID)
        REFERENCES TRIP(TripID) ON DELETE CASCADE,
    CONSTRAINT FK_SSTRIP_ROUTE FOREIGN KEY (RouteID)
        REFERENCES ROUTE(RouteID)
);

CREATE TABLE ON_DEMAND_TRIP (
    TripID              VARCHAR2(10)  NOT NULL,
    Origin              VARCHAR2(100) NOT NULL,
    Destination         VARCHAR2(100) NOT NULL,
    EstimatedDistanceKm NUMBER(6,2)   NOT NULL,
    CONSTRAINT PK_ON_DEMAND_TRIP PRIMARY KEY (TripID),
    CONSTRAINT FK_ODTRIP_TRIP FOREIGN KEY (TripID)
        REFERENCES TRIP(TripID) ON DELETE CASCADE,
    CONSTRAINT CHK_ODTRIP_DIST CHECK (EstimatedDistanceKm > 0)
);

-- 1.4 Subscriptions, tickets and payments -----------------------------
CREATE TABLE STAFF_SUBSCRIPTION (
    SubscriptionID  VARCHAR2(10) NOT NULL,
    PassengerID     VARCHAR2(10) NOT NULL,
    RouteID         VARCHAR2(10) NOT NULL,
    MonthlyBaseFare NUMBER(8,2)  NOT NULL,
    StartDate       DATE         DEFAULT SYSDATE NOT NULL,
    Status          VARCHAR2(10) DEFAULT 'ACTIVE' NOT NULL,
    CONSTRAINT PK_STAFF_SUBSCRIPTION PRIMARY KEY (SubscriptionID),
    CONSTRAINT FK_SUB_PASSENGER FOREIGN KEY (PassengerID) REFERENCES PASSENGER(PassengerID),
    CONSTRAINT FK_SUB_ROUTE FOREIGN KEY (RouteID) REFERENCES ROUTE(RouteID),
    CONSTRAINT UQ_SUB_PASSENGER_ROUTE UNIQUE (PassengerID, RouteID),
    CONSTRAINT CHK_SUB_FARE CHECK (MonthlyBaseFare >= 0),
    CONSTRAINT CHK_SUB_STATUS CHECK (Status IN ('ACTIVE','CANCELLED'))
);

-- Fare is 0 for staff-service tickets (covered by the monthly subscription).
-- SeatNo becomes NULL when a ticket is cancelled, freeing the seat.
CREATE TABLE TICKET (
    TicketID    VARCHAR2(10) NOT NULL,
    PassengerID VARCHAR2(10) NOT NULL,
    TripID      VARCHAR2(10) NOT NULL,
    BookingDate DATE         DEFAULT SYSDATE NOT NULL,
    SeatNo      NUMBER(3),
    Fare        NUMBER(8,2)  DEFAULT 0 NOT NULL,
    Status      VARCHAR2(10) DEFAULT 'BOOKED' NOT NULL,
    CONSTRAINT PK_TICKET PRIMARY KEY (TicketID),
    CONSTRAINT FK_TICKET_PASSENGER FOREIGN KEY (PassengerID) REFERENCES PASSENGER(PassengerID),
    CONSTRAINT FK_TICKET_TRIP FOREIGN KEY (TripID) REFERENCES TRIP(TripID),
    CONSTRAINT UQ_TICKET_SEAT UNIQUE (TripID, SeatNo),
    CONSTRAINT CHK_TICKET_FARE CHECK (Fare >= 0),
    CONSTRAINT CHK_TICKET_STATUS CHECK (Status IN ('BOOKED','COMPLETED','CANCELLED')),
    CONSTRAINT CHK_TICKET_SEAT CHECK (SeatNo IS NOT NULL OR Status = 'CANCELLED')
);

CREATE TABLE PAYMENT (
    PaymentID     VARCHAR2(10) NOT NULL,
    TotalAmount   NUMBER(8,2)  NOT NULL,
    PaymentDate   DATE         DEFAULT SYSDATE NOT NULL,
    PaymentMethod VARCHAR2(10) DEFAULT 'CASH' NOT NULL,
    PaymentStatus VARCHAR2(10) DEFAULT 'PAID' NOT NULL,
    CONSTRAINT PK_PAYMENT PRIMARY KEY (PaymentID),
    CONSTRAINT CHK_PAY_AMOUNT CHECK (TotalAmount >= 0),
    CONSTRAINT CHK_PAY_METHOD CHECK (PaymentMethod IN ('CASH','CARD','ONLINE')),
    CONSTRAINT CHK_PAY_STATUS CHECK (PaymentStatus IN ('PAID','PENDING','REFUNDED'))
);

CREATE TABLE ON_DEMAND_PAYMENT (
    PaymentID  VARCHAR2(10) NOT NULL,
    TicketID   VARCHAR2(10) NOT NULL,
    DistanceKm NUMBER(6,2)  NOT NULL,
    CONSTRAINT PK_ON_DEMAND_PAYMENT PRIMARY KEY (PaymentID),
    CONSTRAINT UQ_ODPAY_TICKET UNIQUE (TicketID),
    CONSTRAINT FK_ODPAY_PAYMENT FOREIGN KEY (PaymentID)
        REFERENCES PAYMENT(PaymentID) ON DELETE CASCADE,
    CONSTRAINT FK_ODPAY_TICKET FOREIGN KEY (TicketID) REFERENCES TICKET(TicketID),
    CONSTRAINT CHK_ODPAY_DIST CHECK (DistanceKm > 0)
);

CREATE TABLE STAFF_MONTHLY_PAYMENT (
    PaymentID       VARCHAR2(10) NOT NULL,
    SubscriptionID  VARCHAR2(10) NOT NULL,
    BillingMonth    VARCHAR2(7)  NOT NULL,
    TotalDistanceKm NUMBER(7,2)  NOT NULL,
    CONSTRAINT PK_STAFF_MONTHLY_PAYMENT PRIMARY KEY (PaymentID),
    CONSTRAINT UQ_SMPAY_SUB_MONTH UNIQUE (SubscriptionID, BillingMonth),
    CONSTRAINT FK_SMPAY_PAYMENT FOREIGN KEY (PaymentID)
        REFERENCES PAYMENT(PaymentID) ON DELETE CASCADE,
    CONSTRAINT FK_SMPAY_SUBSCRIPTION FOREIGN KEY (SubscriptionID)
        REFERENCES STAFF_SUBSCRIPTION(SubscriptionID),
    CONSTRAINT CHK_SMPAY_DIST CHECK (TotalDistanceKm >= 0)
);

-- 1.5 Operational and feedback tables ---------------------------------
CREATE TABLE MAINTENANCE_RECORD (
    MaintenanceID   VARCHAR2(10)  NOT NULL,
    VehicleID       VARCHAR2(10)  NOT NULL,
    ServiceDate     DATE          NOT NULL,
    Cost            NUMBER(8,2)   NOT NULL,
    MaintenanceType VARCHAR2(12)  DEFAULT 'ROUTINE' NOT NULL,
    Description     VARCHAR2(200),
    NextServiceDate DATE          NOT NULL,
    CONSTRAINT PK_MAINTENANCE PRIMARY KEY (MaintenanceID),
    CONSTRAINT FK_MAINT_VEHICLE FOREIGN KEY (VehicleID)
        REFERENCES VEHICLE(VehicleID) ON DELETE CASCADE,
    CONSTRAINT CHK_MAINT_COST CHECK (Cost >= 0),
    CONSTRAINT CHK_MAINT_TYPE CHECK (MaintenanceType IN ('ROUTINE','REPAIR','INSPECTION')),
    CONSTRAINT CHK_MAINT_NEXT CHECK (NextServiceDate > ServiceDate)
);

CREATE TABLE FEEDBACK (
    FeedbackID   VARCHAR2(10)  NOT NULL,
    TripID       VARCHAR2(10)  NOT NULL,
    PassengerID  VARCHAR2(10)  NOT NULL,
    Rating       NUMBER(1)     NOT NULL,
    Comments     VARCHAR2(500),
    FeedbackDate DATE          DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_FEEDBACK PRIMARY KEY (FeedbackID),
    CONSTRAINT UQ_FB_TRIP_PASSENGER UNIQUE (TripID, PassengerID),
    CONSTRAINT FK_FB_TRIP FOREIGN KEY (TripID)
        REFERENCES TRIP(TripID) ON DELETE CASCADE,
    CONSTRAINT FK_FB_PASSENGER FOREIGN KEY (PassengerID)
        REFERENCES PASSENGER(PassengerID) ON DELETE CASCADE,
    CONSTRAINT CHK_FB_RATING CHECK (Rating BETWEEN 1 AND 5)
);

-- 1.6 Audit log (filled by triggers) ----------------------------------
CREATE TABLE AUDIT_LOG (
    LogID     NUMBER        NOT NULL,
    TableName VARCHAR2(30)  NOT NULL,
    Action    VARCHAR2(10)  NOT NULL,
    KeyValue  VARCHAR2(50),
    Details   VARCHAR2(200),
    ChangedBy VARCHAR2(30)  DEFAULT USER,
    ChangedAt DATE          DEFAULT SYSDATE,
    CONSTRAINT PK_AUDIT_LOG PRIMARY KEY (LogID)
);

----------------------------------------------------------------------------------------------------------------------------------------------------------------

-- 2. INDEXES (foreign keys and common report filters)


CREATE INDEX IDX_TICKET_PASSENGER ON TICKET(PassengerID);
CREATE INDEX IDX_TRIP_DATE        ON TRIP(TripDate);
CREATE INDEX IDX_SSTRIP_ROUTE     ON STAFF_SERVICE_TRIP(RouteID);
CREATE INDEX IDX_MAINT_VEHICLE    ON MAINTENANCE_RECORD(VehicleID, ServiceDate);
CREATE INDEX IDX_PAYMENT_DATE     ON PAYMENT(PaymentDate);
CREATE INDEX IDX_SUB_ROUTE        ON STAFF_SUBSCRIPTION(RouteID);

----------------------------------------------------------------------------------------------------------------------------------------------------------------

-- 3. TRIGGERS


-- 3.1 A trip may only be scheduled with an ACTIVE driver and ACTIVE vehicle
CREATE OR REPLACE TRIGGER TRG_TRIP_VALIDATE
BEFORE INSERT OR UPDATE OF DriverID, VehicleID, Status ON TRIP
FOR EACH ROW
DECLARE
    v_driver_status  DRIVER.Status%TYPE;
    v_vehicle_status VEHICLE.Status%TYPE;
BEGIN
    IF :NEW.Status IN ('SCHEDULED','IN_PROGRESS') THEN
        SELECT Status INTO v_driver_status
          FROM DRIVER WHERE DriverID = :NEW.DriverID;
        IF v_driver_status <> 'ACTIVE' THEN
            RAISE_APPLICATION_ERROR(-20001,
                'Driver ' || :NEW.DriverID || ' is ' || v_driver_status || ' and cannot be assigned to a trip.');
        END IF;

        SELECT Status INTO v_vehicle_status
          FROM VEHICLE WHERE VehicleID = :NEW.VehicleID;
        IF v_vehicle_status <> 'ACTIVE' THEN
            RAISE_APPLICATION_ERROR(-20002,
                'Vehicle ' || :NEW.VehicleID || ' is ' || v_vehicle_status || ' and cannot be assigned to a trip.');
        END IF;
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20003, 'Trip references an unknown driver or vehicle.');
END TRG_TRIP_VALIDATE;
/

-- 3.2 Tickets: no booking on cancelled trips, seat must exist in the vehicle
CREATE OR REPLACE TRIGGER TRG_TICKET_VALIDATE
BEFORE INSERT OR UPDATE OF SeatNo, Status ON TICKET
FOR EACH ROW
DECLARE
    v_trip_status TRIP.Status%TYPE;
    v_capacity    VEHICLE.SeatCapacity%TYPE;
BEGIN
    IF :NEW.Status <> 'CANCELLED' THEN
        SELECT t.Status, v.SeatCapacity
          INTO v_trip_status, v_capacity
          FROM TRIP t
          JOIN VEHICLE v ON v.VehicleID = t.VehicleID
         WHERE t.TripID = :NEW.TripID;

        IF v_trip_status = 'CANCELLED' THEN
            RAISE_APPLICATION_ERROR(-20010, 'Trip ' || :NEW.TripID || ' is cancelled; tickets cannot be issued.');
        END IF;

        IF :NEW.SeatNo IS NOT NULL AND :NEW.SeatNo > v_capacity THEN
            RAISE_APPLICATION_ERROR(-20011,
                'Seat ' || :NEW.SeatNo || ' exceeds vehicle capacity of ' || v_capacity || '.');
        END IF;
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20012, 'Trip ' || :NEW.TripID || ' does not exist.');
END TRG_TICKET_VALIDATE;
/

-- 3.3 Feedback: only for completed trips the passenger actually travelled on
CREATE OR REPLACE TRIGGER TRG_FEEDBACK_VALIDATE
BEFORE INSERT ON FEEDBACK
FOR EACH ROW
DECLARE
    v_trip_status TRIP.Status%TYPE;
    v_tickets     NUMBER;
BEGIN
    SELECT Status INTO v_trip_status FROM TRIP WHERE TripID = :NEW.TripID;

    IF v_trip_status <> 'COMPLETED' THEN
        RAISE_APPLICATION_ERROR(-20020, 'Feedback can only be left for COMPLETED trips.');
    END IF;

    SELECT COUNT(*) INTO v_tickets
      FROM TICKET
     WHERE TripID = :NEW.TripID
       AND PassengerID = :NEW.PassengerID
       AND Status <> 'CANCELLED';

    IF v_tickets = 0 THEN
        RAISE_APPLICATION_ERROR(-20021, 'Passenger ' || :NEW.PassengerID || ' has no valid ticket for this trip.');
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20022, 'Trip ' || :NEW.TripID || ' does not exist.');
END TRG_FEEDBACK_VALIDATE;
/

-- 3.4 Maintenance: not for retired vehicles; today/future service blocks the vehicle
CREATE OR REPLACE TRIGGER TRG_MAINT_VEHICLE_STATUS
AFTER INSERT ON MAINTENANCE_RECORD
FOR EACH ROW
DECLARE
    v_status VEHICLE.Status%TYPE;
BEGIN
    SELECT Status INTO v_status FROM VEHICLE WHERE VehicleID = :NEW.VehicleID;

    IF v_status = 'RETIRED' THEN
        RAISE_APPLICATION_ERROR(-20030, 'Vehicle ' || :NEW.VehicleID || ' is retired; maintenance cannot be recorded.');
    END IF;

    IF :NEW.ServiceDate >= TRUNC(SYSDATE) THEN
        UPDATE VEHICLE SET Status = 'UNDER_MAINTENANCE' WHERE VehicleID = :NEW.VehicleID;
    END IF;
END TRG_MAINT_VEHICLE_STATUS;
/

-- 3.5 Audit trail for payments
CREATE OR REPLACE TRIGGER TRG_PAYMENT_AUDIT
AFTER INSERT OR UPDATE OR DELETE ON PAYMENT
FOR EACH ROW
DECLARE
    v_action  VARCHAR2(10);
    v_key     VARCHAR2(10);
    v_details VARCHAR2(200);
BEGIN
    IF INSERTING THEN
        v_action  := 'INSERT';
        v_key     := :NEW.PaymentID;
        v_details := 'Amount=' || :NEW.TotalAmount || ' Status=' || :NEW.PaymentStatus;
    ELSIF UPDATING THEN
        v_action  := 'UPDATE';
        v_key     := :NEW.PaymentID;
        v_details := 'Status ' || :OLD.PaymentStatus || ' -> ' || :NEW.PaymentStatus;
    ELSE
        v_action  := 'DELETE';
        v_key     := :OLD.PaymentID;
        v_details := 'Amount=' || :OLD.TotalAmount || ' Status=' || :OLD.PaymentStatus;
    END IF;

    INSERT INTO AUDIT_LOG (LogID, TableName, Action, KeyValue, Details)
    VALUES (SEQ_AUDIT.NEXTVAL, 'PAYMENT', v_action, v_key, v_details);
END TRG_PAYMENT_AUDIT;
/

-- 3.6 Audit trail for ticket status changes
CREATE OR REPLACE TRIGGER TRG_TICKET_AUDIT
AFTER UPDATE OF Status ON TICKET
FOR EACH ROW
WHEN (OLD.Status <> NEW.Status)
BEGIN
    INSERT INTO AUDIT_LOG (LogID, TableName, Action, KeyValue, Details)
    VALUES (SEQ_AUDIT.NEXTVAL, 'TICKET', 'UPDATE', :NEW.TicketID,
            'Status ' || :OLD.Status || ' -> ' || :NEW.Status);
END TRG_TICKET_AUDIT;
/

------------------------------------------------------------------------------------------------------------------------------------------------------------------------

-- 4. FUNCTIONS


-- 4.1 Rate per km of a vehicle (looks in BUS then VAN)
CREATE OR REPLACE FUNCTION fn_get_rate_per_km (
    p_vehicle_id IN VEHICLE.VehicleID%TYPE
) RETURN NUMBER
IS
    v_rate NUMBER;
BEGIN
    SELECT rate_km INTO v_rate
      FROM (SELECT RatePerKm AS rate_km FROM BUS WHERE VehicleID = p_vehicle_id
            UNION ALL
            SELECT RatePerKm AS rate_km FROM VAN WHERE VehicleID = p_vehicle_id);
    RETURN v_rate;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20100, 'No rate per km found for vehicle ' || p_vehicle_id);
END fn_get_rate_per_km;
/

-- 4.2 On-demand fare = distance x vehicle rate per km
CREATE OR REPLACE FUNCTION fn_calc_on_demand_fare (
    p_vehicle_id  IN VEHICLE.VehicleID%TYPE,
    p_distance_km IN NUMBER
) RETURN NUMBER
IS
BEGIN
    IF p_distance_km IS NULL OR p_distance_km <= 0 THEN
        RAISE_APPLICATION_ERROR(-20101, 'Distance must be greater than zero.');
    END IF;
    RETURN ROUND(p_distance_km * fn_get_rate_per_km(p_vehicle_id), 2);
END fn_calc_on_demand_fare;
/

-- 4.3 Monthly staff bill = base fare + (distance x surcharge per km)
CREATE OR REPLACE FUNCTION fn_calc_monthly_bill (
    p_subscription_id IN STAFF_SUBSCRIPTION.SubscriptionID%TYPE,
    p_total_km        IN NUMBER
) RETURN NUMBER
IS
    c_km_surcharge CONSTANT NUMBER := 8;
    v_base         STAFF_SUBSCRIPTION.MonthlyBaseFare%TYPE;
BEGIN
    IF p_total_km IS NULL OR p_total_km < 0 THEN
        RAISE_APPLICATION_ERROR(-20102, 'Total distance cannot be negative.');
    END IF;

    SELECT MonthlyBaseFare INTO v_base
      FROM STAFF_SUBSCRIPTION
     WHERE SubscriptionID = p_subscription_id;

    RETURN ROUND(v_base + p_total_km * c_km_surcharge, 2);
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20103, 'Subscription ' || p_subscription_id || ' not found.');
END fn_calc_monthly_bill;
/

-- 4.4 Free (unbooked) seats on a trip
CREATE OR REPLACE FUNCTION fn_available_seats (
    p_trip_id IN TRIP.TripID%TYPE
) RETURN NUMBER
IS
    v_free NUMBER;
BEGIN
    SELECT v.SeatCapacity
           - (SELECT COUNT(*) FROM TICKET k
               WHERE k.TripID = t.TripID AND k.Status <> 'CANCELLED')
      INTO v_free
      FROM TRIP t
      JOIN VEHICLE v ON v.VehicleID = t.VehicleID
     WHERE t.TripID = p_trip_id;
    RETURN v_free;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20104, 'Trip ' || p_trip_id || ' not found.');
END fn_available_seats;
/

-- 4.5 Lowest free seat number on a trip
CREATE OR REPLACE FUNCTION fn_next_free_seat (
    p_trip_id IN TRIP.TripID%TYPE
) RETURN NUMBER
IS
    v_capacity VEHICLE.SeatCapacity%TYPE;
    v_seat     NUMBER;
BEGIN
    SELECT v.SeatCapacity INTO v_capacity
      FROM TRIP t
      JOIN VEHICLE v ON v.VehicleID = t.VehicleID
     WHERE t.TripID = p_trip_id;

    SELECT MIN(n) INTO v_seat
      FROM (SELECT LEVEL AS n FROM DUAL CONNECT BY LEVEL <= v_capacity)
     WHERE n NOT IN (SELECT SeatNo FROM TICKET
                      WHERE TripID = p_trip_id AND SeatNo IS NOT NULL);

    IF v_seat IS NULL THEN
        RAISE_APPLICATION_ERROR(-20105, 'Trip ' || p_trip_id || ' is fully booked.');
    END IF;
    RETURN v_seat;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20104, 'Trip ' || p_trip_id || ' not found.');
END fn_next_free_seat;
/

-- 4.6 Average passenger rating of a driver (NULL when no reviews)
CREATE OR REPLACE FUNCTION fn_driver_avg_rating (
    p_driver_id IN DRIVER.DriverID%TYPE
) RETURN NUMBER
IS
    v_avg NUMBER;
BEGIN
    SELECT ROUND(AVG(f.Rating), 2) INTO v_avg
      FROM FEEDBACK f
      JOIN TRIP t ON t.TripID = f.TripID
     WHERE t.DriverID = p_driver_id;
    RETURN v_avg;
END fn_driver_avg_rating;
/

-- 4.7 Total revenue (PAID payments) between two dates, inclusive
CREATE OR REPLACE FUNCTION fn_total_revenue (
    p_from IN DATE,
    p_to   IN DATE
) RETURN NUMBER
IS
    v_total NUMBER;
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
        RAISE_APPLICATION_ERROR(-20106, 'Invalid date range supplied.');
    END IF;

    SELECT NVL(SUM(TotalAmount), 0) INTO v_total
      FROM PAYMENT
     WHERE PaymentStatus = 'PAID'
       AND PaymentDate >= TRUNC(p_from)
       AND PaymentDate <  TRUNC(p_to) + 1;
    RETURN v_total;
END fn_total_revenue;
/

---------------------------------------------------------------------------------------------------------------------------------------------------------------------

-- 5. PROCEDURES (business operations)


-- 5.1 Driver management
CREATE OR REPLACE PROCEDURE pr_add_driver (
    p_full_name IN  DRIVER.FullName%TYPE,
    p_license   IN  DRIVER.LicenseNumber%TYPE,
    p_phone     IN  DRIVER.Phone%TYPE,
    p_driver_id OUT DRIVER.DriverID%TYPE
) IS
BEGIN
    p_driver_id := 'DRV' || SEQ_DRIVER.NEXTVAL;
    INSERT INTO DRIVER (DriverID, FullName, LicenseNumber, Phone)
    VALUES (p_driver_id, p_full_name, p_license, p_phone);
    COMMIT;
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20110, 'A driver with licence ' || p_license || ' already exists.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_add_driver;
/

CREATE OR REPLACE PROCEDURE pr_set_driver_status (
    p_driver_id IN DRIVER.DriverID%TYPE,
    p_status    IN DRIVER.Status%TYPE
) IS
BEGIN
    UPDATE DRIVER SET Status = p_status WHERE DriverID = p_driver_id;
    IF SQL%ROWCOUNT = 0 THEN
        RAISE_APPLICATION_ERROR(-20112, 'Driver ' || p_driver_id || ' not found.');
    END IF;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_set_driver_status;
/

-- 5.2 Vehicle management (pass NULL for the attribute that does not apply)
CREATE OR REPLACE PROCEDURE pr_add_vehicle (
    p_registration_no IN  VEHICLE.RegistrationNo%TYPE,
    p_vehicle_type    IN  VEHICLE.VehicleType%TYPE,
    p_seat_capacity   IN  VEHICLE.SeatCapacity%TYPE,
    p_rate_per_km     IN  NUMBER,
    p_decks           IN  NUMBER,
    p_cargo_m3        IN  NUMBER,
    p_owner_driver_id IN  VEHICLE.OwnerDriverID%TYPE,
    p_vehicle_id      OUT VEHICLE.VehicleID%TYPE
) IS
BEGIN
    p_vehicle_id := 'VEH' || SEQ_VEHICLE.NEXTVAL;

    INSERT INTO VEHICLE (VehicleID, RegistrationNo, VehicleType, SeatCapacity, OwnerDriverID)
    VALUES (p_vehicle_id, p_registration_no, p_vehicle_type, p_seat_capacity, p_owner_driver_id);

    IF p_vehicle_type = 'BUS' THEN
        INSERT INTO BUS (VehicleID, NumberOfDecks, RatePerKm)
        VALUES (p_vehicle_id, NVL(p_decks, 1), p_rate_per_km);
    ELSIF p_vehicle_type = 'VAN' THEN
        INSERT INTO VAN (VehicleID, CargoSpaceM3, RatePerKm)
        VALUES (p_vehicle_id, NVL(p_cargo_m3, 0), p_rate_per_km);
    END IF;
    COMMIT;
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20111, 'Registration number ' || p_registration_no || ' already exists.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_add_vehicle;
/

CREATE OR REPLACE PROCEDURE pr_set_vehicle_status (
    p_vehicle_id IN VEHICLE.VehicleID%TYPE,
    p_status     IN VEHICLE.Status%TYPE
) IS
BEGIN
    UPDATE VEHICLE SET Status = p_status WHERE VehicleID = p_vehicle_id;
    IF SQL%ROWCOUNT = 0 THEN
        RAISE_APPLICATION_ERROR(-20113, 'Vehicle ' || p_vehicle_id || ' not found.');
    END IF;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_set_vehicle_status;
/

-- 5.3 Route management
CREATE OR REPLACE PROCEDURE pr_add_route (
    p_route_name  IN  ROUTE.RouteName%TYPE,
    p_distance_km IN  ROUTE.TotalDistanceKm%TYPE,
    p_route_id    OUT ROUTE.RouteID%TYPE
) IS
BEGIN
    p_route_id := 'RT' || SEQ_ROUTE.NEXTVAL;
    INSERT INTO ROUTE (RouteID, RouteName, TotalDistanceKm)
    VALUES (p_route_id, p_route_name, p_distance_km);
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_add_route;
/

CREATE OR REPLACE PROCEDURE pr_add_route_stop (
    p_route_id  IN ROUTE_STOP.RouteID%TYPE,
    p_stop_seq  IN ROUTE_STOP.StopSeqNo%TYPE,
    p_stop_name IN ROUTE_STOP.StopName%TYPE
) IS
BEGIN
    INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName)
    VALUES (p_route_id, p_stop_seq, p_stop_name);
    COMMIT;
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20114, 'Stop number ' || p_stop_seq || ' already exists on route ' || p_route_id || '.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_add_route_stop;
/

-- 5.4 Passenger management
CREATE OR REPLACE PROCEDURE pr_add_passenger (
    p_name         IN  PASSENGER.Name%TYPE,
    p_phone        IN  PASSENGER.Phone%TYPE,
    p_email        IN  PASSENGER.Email%TYPE,
    p_type         IN  PASSENGER.PassengerType%TYPE,
    p_passenger_id OUT PASSENGER.PassengerID%TYPE
) IS
BEGIN
    p_passenger_id := 'PAS' || SEQ_PASSENGER.NEXTVAL;
    INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType)
    VALUES (p_passenger_id, p_name, p_phone, p_email, p_type);
    COMMIT;
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20115, 'A passenger with e-mail ' || p_email || ' already exists.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_add_passenger;
/

CREATE OR REPLACE PROCEDURE pr_create_subscription (
    p_passenger_id IN  STAFF_SUBSCRIPTION.PassengerID%TYPE,
    p_route_id     IN  STAFF_SUBSCRIPTION.RouteID%TYPE,
    p_monthly_fare IN  STAFF_SUBSCRIPTION.MonthlyBaseFare%TYPE,
    p_sub_id       OUT STAFF_SUBSCRIPTION.SubscriptionID%TYPE
) IS
BEGIN
    p_sub_id := 'SUB' || SEQ_SUBSCRIPTION.NEXTVAL;
    INSERT INTO STAFF_SUBSCRIPTION (SubscriptionID, PassengerID, RouteID, MonthlyBaseFare)
    VALUES (p_sub_id, p_passenger_id, p_route_id, p_monthly_fare);
    COMMIT;
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20116, 'Passenger ' || p_passenger_id || ' already has a subscription on route ' || p_route_id || '.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_create_subscription;
/

-- 5.5 Trip scheduling
CREATE OR REPLACE PROCEDURE pr_schedule_staff_trip (
    p_trip_date  IN  TRIP.TripDate%TYPE,
    p_driver_id  IN  TRIP.DriverID%TYPE,
    p_vehicle_id IN  TRIP.VehicleID%TYPE,
    p_route_id   IN  STAFF_SERVICE_TRIP.RouteID%TYPE,
    p_trip_id    OUT TRIP.TripID%TYPE
) IS
BEGIN
    IF p_trip_date < SYSDATE THEN
        RAISE_APPLICATION_ERROR(-20120, 'A trip cannot be scheduled in the past.');
    END IF;

    p_trip_id := 'TRP' || SEQ_TRIP.NEXTVAL;
    INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status)
    VALUES (p_trip_id, p_trip_date, p_driver_id, p_vehicle_id, 'SCHEDULED');
    INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID)
    VALUES (p_trip_id, p_route_id);
    COMMIT;
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20121, 'The driver or vehicle is already assigned to a trip at that time.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_schedule_staff_trip;
/

CREATE OR REPLACE PROCEDURE pr_schedule_on_demand_trip (
    p_trip_date   IN  TRIP.TripDate%TYPE,
    p_driver_id   IN  TRIP.DriverID%TYPE,
    p_vehicle_id  IN  TRIP.VehicleID%TYPE,
    p_origin      IN  ON_DEMAND_TRIP.Origin%TYPE,
    p_destination IN  ON_DEMAND_TRIP.Destination%TYPE,
    p_distance_km IN  ON_DEMAND_TRIP.EstimatedDistanceKm%TYPE,
    p_trip_id     OUT TRIP.TripID%TYPE
) IS
BEGIN
    IF p_trip_date < SYSDATE THEN
        RAISE_APPLICATION_ERROR(-20120, 'A trip cannot be scheduled in the past.');
    END IF;

    p_trip_id := 'TRP' || SEQ_TRIP.NEXTVAL;
    INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status)
    VALUES (p_trip_id, p_trip_date, p_driver_id, p_vehicle_id, 'SCHEDULED');
    INSERT INTO ON_DEMAND_TRIP (TripID, Origin, Destination, EstimatedDistanceKm)
    VALUES (p_trip_id, p_origin, p_destination, p_distance_km);
    COMMIT;
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20121, 'The driver or vehicle is already assigned to a trip at that time.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_schedule_on_demand_trip;
/

-- 5.6 Ticket booking
CREATE OR REPLACE PROCEDURE pr_book_ticket (
    p_passenger_id IN  PASSENGER.PassengerID%TYPE,
    p_trip_id      IN  TRIP.TripID%TYPE,
    p_ticket_id    OUT TICKET.TicketID%TYPE
) IS
    v_status   TRIP.Status%TYPE;
    v_vehicle  TRIP.VehicleID%TYPE;
    v_route    STAFF_SERVICE_TRIP.RouteID%TYPE;
    v_distance ON_DEMAND_TRIP.EstimatedDistanceKm%TYPE;
    v_fare     TICKET.Fare%TYPE := 0;
    v_seat     TICKET.SeatNo%TYPE;
    v_count    NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM PASSENGER WHERE PassengerID = p_passenger_id;
    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20200, 'Passenger ' || p_passenger_id || ' not found.');
    END IF;

    SELECT COUNT(*) INTO v_count FROM TRIP WHERE TripID = p_trip_id;
    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20201, 'Trip ' || p_trip_id || ' not found.');
    END IF;

    SELECT Status, VehicleID INTO v_status, v_vehicle FROM TRIP WHERE TripID = p_trip_id;
    IF v_status <> 'SCHEDULED' THEN
        RAISE_APPLICATION_ERROR(-20202, 'Trip ' || p_trip_id || ' is ' || v_status || '; only SCHEDULED trips can be booked.');
    END IF;

    SELECT COUNT(*) INTO v_count
      FROM TICKET
     WHERE PassengerID = p_passenger_id AND TripID = p_trip_id AND Status <> 'CANCELLED';
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20204, 'Passenger already holds a ticket for this trip.');
    END IF;

    SELECT COUNT(*) INTO v_count FROM STAFF_SERVICE_TRIP WHERE TripID = p_trip_id;
    IF v_count = 1 THEN
        -- Staff service trip: passenger needs an active subscription on the route
        SELECT RouteID INTO v_route FROM STAFF_SERVICE_TRIP WHERE TripID = p_trip_id;
        SELECT COUNT(*) INTO v_count
          FROM STAFF_SUBSCRIPTION
         WHERE PassengerID = p_passenger_id AND RouteID = v_route AND Status = 'ACTIVE';
        IF v_count = 0 THEN
            RAISE_APPLICATION_ERROR(-20203, 'Passenger has no active subscription on route ' || v_route || '.');
        END IF;
        v_fare := 0;
    ELSE
        -- On-demand trip: fare is distance x vehicle rate
        SELECT EstimatedDistanceKm INTO v_distance FROM ON_DEMAND_TRIP WHERE TripID = p_trip_id;
        v_fare := fn_calc_on_demand_fare(v_vehicle, v_distance);
    END IF;

    v_seat := fn_next_free_seat(p_trip_id);

    p_ticket_id := 'TKT' || SEQ_TICKET.NEXTVAL;
    INSERT INTO TICKET (TicketID, PassengerID, TripID, SeatNo, Fare, Status)
    VALUES (p_ticket_id, p_passenger_id, p_trip_id, v_seat, v_fare, 'BOOKED');
    COMMIT;
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20205, 'The seat was just taken by another booking. Please try again.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_book_ticket;
/

CREATE OR REPLACE PROCEDURE pr_cancel_ticket (
    p_ticket_id IN TICKET.TicketID%TYPE
) IS
    v_status TICKET.Status%TYPE;
BEGIN
    SELECT Status INTO v_status FROM TICKET WHERE TicketID = p_ticket_id FOR UPDATE;

    IF v_status <> 'BOOKED' THEN
        RAISE_APPLICATION_ERROR(-20210, 'Only BOOKED tickets can be cancelled (current status: ' || v_status || ').');
    END IF;

    UPDATE TICKET SET Status = 'CANCELLED', SeatNo = NULL WHERE TicketID = p_ticket_id;

    -- Refund a paid on-demand payment, discard an unpaid one
    UPDATE PAYMENT SET PaymentStatus = 'REFUNDED'
     WHERE PaymentStatus = 'PAID'
       AND PaymentID IN (SELECT PaymentID FROM ON_DEMAND_PAYMENT WHERE TicketID = p_ticket_id);

    DELETE FROM PAYMENT
     WHERE PaymentStatus = 'PENDING'
       AND PaymentID IN (SELECT PaymentID FROM ON_DEMAND_PAYMENT WHERE TicketID = p_ticket_id);

    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20211, 'Ticket ' || p_ticket_id || ' not found.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_cancel_ticket;
/

-- 5.7 Trip status management
CREATE OR REPLACE PROCEDURE pr_complete_trip (
    p_trip_id IN TRIP.TripID%TYPE
) IS
    v_status TRIP.Status%TYPE;
BEGIN
    SELECT Status INTO v_status FROM TRIP WHERE TripID = p_trip_id FOR UPDATE;

    IF v_status NOT IN ('SCHEDULED','IN_PROGRESS') THEN
        RAISE_APPLICATION_ERROR(-20280, 'Trip ' || p_trip_id || ' is ' || v_status || ' and cannot be completed.');
    END IF;

    UPDATE TRIP SET Status = 'COMPLETED' WHERE TripID = p_trip_id;
    UPDATE TICKET SET Status = 'COMPLETED' WHERE TripID = p_trip_id AND Status = 'BOOKED';
    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20281, 'Trip ' || p_trip_id || ' not found.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_complete_trip;
/

-- Cancels the trip and every BOOKED ticket on it (uses a cursor)
CREATE OR REPLACE PROCEDURE pr_cancel_trip (
    p_trip_id IN TRIP.TripID%TYPE
) IS
    v_status TRIP.Status%TYPE;
    v_count  PLS_INTEGER := 0;
    CURSOR c_tickets IS
        SELECT TicketID FROM TICKET
         WHERE TripID = p_trip_id AND Status = 'BOOKED';
BEGIN
    SELECT Status INTO v_status FROM TRIP WHERE TripID = p_trip_id FOR UPDATE;

    IF v_status IN ('COMPLETED','CANCELLED') THEN
        RAISE_APPLICATION_ERROR(-20290, 'Trip ' || p_trip_id || ' is ' || v_status || ' and cannot be cancelled.');
    END IF;

    UPDATE TRIP SET Status = 'CANCELLED' WHERE TripID = p_trip_id;

    FOR rec IN c_tickets LOOP
        pr_cancel_ticket(rec.TicketID);
        v_count := v_count + 1;
    END LOOP;

    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Trip ' || p_trip_id || ' cancelled; ' || v_count || ' ticket(s) cancelled.');
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20291, 'Trip ' || p_trip_id || ' not found.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_cancel_trip;
/

-- 5.8 Payment processing
CREATE OR REPLACE PROCEDURE pr_pay_on_demand (
    p_ticket_id  IN  TICKET.TicketID%TYPE,
    p_method     IN  PAYMENT.PaymentMethod%TYPE,
    p_payment_id OUT PAYMENT.PaymentID%TYPE
) IS
    v_fare   TICKET.Fare%TYPE;
    v_status TICKET.Status%TYPE;
    v_dist   ON_DEMAND_TRIP.EstimatedDistanceKm%TYPE;
    v_count  NUMBER;
BEGIN
    SELECT k.Fare, k.Status, o.EstimatedDistanceKm
      INTO v_fare, v_status, v_dist
      FROM TICKET k
      JOIN ON_DEMAND_TRIP o ON o.TripID = k.TripID
     WHERE k.TicketID = p_ticket_id;

    IF v_status = 'CANCELLED' THEN
        RAISE_APPLICATION_ERROR(-20220, 'Ticket ' || p_ticket_id || ' is cancelled and cannot be paid.');
    END IF;

    SELECT COUNT(*) INTO v_count FROM ON_DEMAND_PAYMENT WHERE TicketID = p_ticket_id;
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20221, 'Ticket ' || p_ticket_id || ' already has a payment.');
    END IF;

    p_payment_id := 'PAY' || SEQ_PAYMENT.NEXTVAL;
    INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentMethod, PaymentStatus)
    VALUES (p_payment_id, v_fare, p_method, 'PAID');
    INSERT INTO ON_DEMAND_PAYMENT (PaymentID, TicketID, DistanceKm)
    VALUES (p_payment_id, p_ticket_id, v_dist);
    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20222, 'Ticket ' || p_ticket_id || ' not found or is not an on-demand ticket.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_pay_on_demand;
/

CREATE OR REPLACE PROCEDURE pr_confirm_payment (
    p_payment_id IN PAYMENT.PaymentID%TYPE
) IS
BEGIN
    UPDATE PAYMENT
       SET PaymentStatus = 'PAID', PaymentDate = SYSDATE
     WHERE PaymentID = p_payment_id AND PaymentStatus = 'PENDING';
    IF SQL%ROWCOUNT = 0 THEN
        RAISE_APPLICATION_ERROR(-20230, 'No PENDING payment found with ID ' || p_payment_id || '.');
    END IF;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_confirm_payment;
/

CREATE OR REPLACE PROCEDURE pr_generate_monthly_bill (
    p_subscription_id IN  STAFF_SUBSCRIPTION.SubscriptionID%TYPE,
    p_billing_month   IN  STAFF_MONTHLY_PAYMENT.BillingMonth%TYPE,
    p_total_km        IN  STAFF_MONTHLY_PAYMENT.TotalDistanceKm%TYPE,
    p_method          IN  PAYMENT.PaymentMethod%TYPE,
    p_payment_id      OUT PAYMENT.PaymentID%TYPE
) IS
    v_amount NUMBER;
    v_status STAFF_SUBSCRIPTION.Status%TYPE;
BEGIN
    IF NOT REGEXP_LIKE(p_billing_month, '^[0-9]{4}-(0[1-9]|1[0-2])$') THEN
        RAISE_APPLICATION_ERROR(-20240, 'Billing month must use the format YYYY-MM.');
    END IF;

    SELECT Status INTO v_status FROM STAFF_SUBSCRIPTION WHERE SubscriptionID = p_subscription_id;
    IF v_status <> 'ACTIVE' THEN
        RAISE_APPLICATION_ERROR(-20242, 'Subscription ' || p_subscription_id || ' is not active.');
    END IF;

    v_amount := fn_calc_monthly_bill(p_subscription_id, p_total_km);

    p_payment_id := 'PAY' || SEQ_PAYMENT.NEXTVAL;
    INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentMethod, PaymentStatus)
    VALUES (p_payment_id, v_amount, p_method, 'PAID');
    INSERT INTO STAFF_MONTHLY_PAYMENT (PaymentID, SubscriptionID, BillingMonth, TotalDistanceKm)
    VALUES (p_payment_id, p_subscription_id, p_billing_month, p_total_km);
    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20243, 'Subscription ' || p_subscription_id || ' not found.');
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20241, 'Subscription ' || p_subscription_id || ' is already billed for ' || p_billing_month || '.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_generate_monthly_bill;
/

-- 5.9 Maintenance management
CREATE OR REPLACE PROCEDURE pr_record_maintenance (
    p_vehicle_id     IN  MAINTENANCE_RECORD.VehicleID%TYPE,
    p_service_date   IN  MAINTENANCE_RECORD.ServiceDate%TYPE,
    p_cost           IN  MAINTENANCE_RECORD.Cost%TYPE,
    p_type           IN  MAINTENANCE_RECORD.MaintenanceType%TYPE,
    p_description    IN  MAINTENANCE_RECORD.Description%TYPE,
    p_next_service   IN  MAINTENANCE_RECORD.NextServiceDate%TYPE,
    p_maintenance_id OUT MAINTENANCE_RECORD.MaintenanceID%TYPE
) IS
BEGIN
    p_maintenance_id := 'MNT' || SEQ_MAINTENANCE.NEXTVAL;
    INSERT INTO MAINTENANCE_RECORD
        (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate)
    VALUES
        (p_maintenance_id, p_vehicle_id, p_service_date, p_cost, p_type, p_description, p_next_service);
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_record_maintenance;
/

-- Puts a serviced vehicle back into ACTIVE service
CREATE OR REPLACE PROCEDURE pr_release_vehicle (
    p_vehicle_id IN VEHICLE.VehicleID%TYPE
) IS
BEGIN
    UPDATE VEHICLE SET Status = 'ACTIVE'
     WHERE VehicleID = p_vehicle_id AND Status = 'UNDER_MAINTENANCE';
    IF SQL%ROWCOUNT = 0 THEN
        RAISE_APPLICATION_ERROR(-20270, 'Vehicle ' || p_vehicle_id || ' is not under maintenance.');
    END IF;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_release_vehicle;
/

-- 5.10 Feedback and reviews
CREATE OR REPLACE PROCEDURE pr_add_feedback (
    p_trip_id      IN  FEEDBACK.TripID%TYPE,
    p_passenger_id IN  FEEDBACK.PassengerID%TYPE,
    p_rating       IN  FEEDBACK.Rating%TYPE,
    p_comments     IN  FEEDBACK.Comments%TYPE,
    p_feedback_id  OUT FEEDBACK.FeedbackID%TYPE
) IS
BEGIN
    p_feedback_id := 'FBK' || SEQ_FEEDBACK.NEXTVAL;
    INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments)
    VALUES (p_feedback_id, p_trip_id, p_passenger_id, p_rating, p_comments);
    COMMIT;
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20260, 'This passenger has already reviewed this trip.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END pr_add_feedback;
/

-----------------------------------------------------------------------------------------------------------------------------------------------------------------

-- 6. VIEWS


CREATE OR REPLACE VIEW VW_TRIP_MONITOR AS
SELECT t.TripID,
       t.TripDate,
       t.Status,
       CASE WHEN s.TripID IS NOT NULL THEN 'STAFF SERVICE' ELSE 'ON DEMAND' END AS TripType,
       NVL(r.RouteName, o.Origin || ' -> ' || o.Destination) AS Journey,
       d.FullName        AS DriverName,
       v.RegistrationNo,
       v.SeatCapacity,
       (SELECT COUNT(*) FROM TICKET k
         WHERE k.TripID = t.TripID AND k.Status <> 'CANCELLED') AS SeatsBooked
  FROM TRIP t
  JOIN DRIVER  d ON d.DriverID  = t.DriverID
  JOIN VEHICLE v ON v.VehicleID = t.VehicleID
  LEFT JOIN STAFF_SERVICE_TRIP s ON s.TripID  = t.TripID
  LEFT JOIN ROUTE              r ON r.RouteID = s.RouteID
  LEFT JOIN ON_DEMAND_TRIP     o ON o.TripID  = t.TripID;

-----------------------------------------------------------------------------------------------------------------------------------------------------------------

-- 7. BUSINESS REPORTS (run with SET SERVEROUTPUT ON)


-- REPORT 1: Most frequently used routes (by non-cancelled ticket bookings)
CREATE OR REPLACE PROCEDURE rpt_route_popularity (
    p_from IN DATE DEFAULT NULL,
    p_to   IN DATE DEFAULT NULL
) IS
    v_from  DATE := TRUNC(NVL(p_from, DATE '1900-01-01'));
    v_to    DATE := TRUNC(NVL(p_to,   DATE '2999-12-31')) + 1;
    v_rank  PLS_INTEGER := 0;
    CURSOR c_routes IS
        SELECT r.RouteID, r.RouteName,
               COUNT(DISTINCT t.TripID) AS trips,
               COUNT(k.TicketID)        AS bookings
          FROM ROUTE r
          LEFT JOIN STAFF_SERVICE_TRIP s ON s.RouteID = r.RouteID
          LEFT JOIN TRIP t   ON t.TripID = s.TripID
                            AND t.TripDate >= v_from AND t.TripDate < v_to
          LEFT JOIN TICKET k ON k.TripID = t.TripID AND k.Status <> 'CANCELLED'
         GROUP BY r.RouteID, r.RouteName
         ORDER BY bookings DESC, r.RouteName;
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== REPORT 1: MOST FREQUENTLY USED ROUTES ===');
    DBMS_OUTPUT.PUT_LINE('Period: ' || NVL(TO_CHAR(p_from, 'YYYY-MM-DD'), 'beginning')
                         || ' to ' || NVL(TO_CHAR(p_to, 'YYYY-MM-DD'), 'today and beyond'));
    DBMS_OUTPUT.PUT_LINE(RPAD('Rank', 6) || RPAD('Route', 8) || RPAD('Route name', 42)
                         || LPAD('Trips', 8) || LPAD('Bookings', 10));
    DBMS_OUTPUT.PUT_LINE(RPAD('-', 74, '-'));

    FOR rec IN c_routes LOOP
        v_rank := v_rank + 1;
        DBMS_OUTPUT.PUT_LINE(RPAD(v_rank, 6) || RPAD(rec.RouteID, 8)
                             || RPAD(SUBSTR(rec.RouteName, 1, 40), 42)
                             || LPAD(rec.trips, 8) || LPAD(rec.bookings, 10));
    END LOOP;

    IF v_rank = 0 THEN
        DBMS_OUTPUT.PUT_LINE('No routes found.');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('ERROR in rpt_route_popularity: ' || SQLERRM);
        RAISE;
END rpt_route_popularity;
/

-- REPORT 2: Revenue from payments within a period
CREATE OR REPLACE PROCEDURE rpt_revenue (
    p_from IN DATE,
    p_to   IN DATE
) IS
    v_total    NUMBER;
    v_refunds  NUMBER;
    v_pending  NUMBER;
    CURSOR c_category IS
        SELECT category, COUNT(*) AS payments, SUM(amount) AS revenue
          FROM (SELECT CASE WHEN o.PaymentID IS NOT NULL THEN 'On-demand trips'
                            WHEN m.PaymentID IS NOT NULL THEN 'Staff monthly subscriptions'
                            ELSE 'Other' END AS category,
                       p.TotalAmount AS amount
                  FROM PAYMENT p
                  LEFT JOIN ON_DEMAND_PAYMENT     o ON o.PaymentID = p.PaymentID
                  LEFT JOIN STAFF_MONTHLY_PAYMENT m ON m.PaymentID = p.PaymentID
                 WHERE p.PaymentStatus = 'PAID'
                   AND p.PaymentDate >= TRUNC(p_from)
                   AND p.PaymentDate <  TRUNC(p_to) + 1)
         GROUP BY category
         ORDER BY category;
    CURSOR c_method IS
        SELECT PaymentMethod, COUNT(*) AS payments, SUM(TotalAmount) AS revenue
          FROM PAYMENT
         WHERE PaymentStatus = 'PAID'
           AND PaymentDate >= TRUNC(p_from)
           AND PaymentDate <  TRUNC(p_to) + 1
         GROUP BY PaymentMethod
         ORDER BY PaymentMethod;
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
        RAISE_APPLICATION_ERROR(-20301, 'Please supply a valid date range (from <= to).');
    END IF;

    DBMS_OUTPUT.PUT_LINE('=== REPORT 2: REVENUE ' || TO_CHAR(p_from, 'YYYY-MM-DD')
                         || ' TO ' || TO_CHAR(p_to, 'YYYY-MM-DD') || ' ===');
    DBMS_OUTPUT.PUT_LINE('-- By revenue source --');
    FOR rec IN c_category LOOP
        DBMS_OUTPUT.PUT_LINE(RPAD(rec.category, 32) || LPAD(rec.payments, 6) || ' payments'
                             || LPAD(TO_CHAR(rec.revenue, 'FM999,999,990.00'), 16));
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('-- By payment method --');
    FOR rec IN c_method LOOP
        DBMS_OUTPUT.PUT_LINE(RPAD(rec.PaymentMethod, 32) || LPAD(rec.payments, 6) || ' payments'
                             || LPAD(TO_CHAR(rec.revenue, 'FM999,999,990.00'), 16));
    END LOOP;

    v_total := fn_total_revenue(p_from, p_to);

    SELECT NVL(SUM(TotalAmount), 0) INTO v_refunds
      FROM PAYMENT
     WHERE PaymentStatus = 'REFUNDED'
       AND PaymentDate >= TRUNC(p_from) AND PaymentDate < TRUNC(p_to) + 1;

    SELECT NVL(SUM(TotalAmount), 0) INTO v_pending
      FROM PAYMENT
     WHERE PaymentStatus = 'PENDING'
       AND PaymentDate >= TRUNC(p_from) AND PaymentDate < TRUNC(p_to) + 1;

    DBMS_OUTPUT.PUT_LINE(RPAD('-', 70, '-'));
    DBMS_OUTPUT.PUT_LINE(RPAD('TOTAL REVENUE (PAID)', 44) || LPAD(TO_CHAR(v_total, 'FM999,999,990.00'), 16));
    DBMS_OUTPUT.PUT_LINE(RPAD('Refunded (excluded)', 44)  || LPAD(TO_CHAR(v_refunds, 'FM999,999,990.00'), 16));
    DBMS_OUTPUT.PUT_LINE(RPAD('Pending (excluded)', 44)   || LPAD(TO_CHAR(v_pending, 'FM999,999,990.00'), 16));
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('ERROR in rpt_revenue: ' || SQLERRM);
        RAISE;
END rpt_revenue;
/

-- REPORT 3: Passenger travel history
CREATE OR REPLACE PROCEDURE rpt_passenger_history (
    p_passenger_id IN PASSENGER.PassengerID%TYPE
) IS
    v_name       PASSENGER.Name%TYPE;
    v_phone      PASSENGER.Phone%TYPE;
    v_type       PASSENGER.PassengerType%TYPE;
    v_rows       PLS_INTEGER := 0;
    v_completed  PLS_INTEGER := 0;
    v_fares      NUMBER := 0;
    v_sub_paid   NUMBER := 0;
    CURSOR c_hist (cp_id VARCHAR2) IS
        SELECT k.TicketID, t.TripDate,
               NVL(r.RouteName, o.Origin || ' -> ' || o.Destination) AS journey,
               v.RegistrationNo, d.FullName AS driver_name,
               k.SeatNo, k.Fare, k.Status
          FROM TICKET k
          JOIN TRIP    t ON t.TripID    = k.TripID
          JOIN VEHICLE v ON v.VehicleID = t.VehicleID
          JOIN DRIVER  d ON d.DriverID  = t.DriverID
          LEFT JOIN STAFF_SERVICE_TRIP s ON s.TripID  = t.TripID
          LEFT JOIN ROUTE              r ON r.RouteID = s.RouteID
          LEFT JOIN ON_DEMAND_TRIP     o ON o.TripID  = t.TripID
         WHERE k.PassengerID = cp_id
         ORDER BY t.TripDate DESC;
BEGIN
    BEGIN
        SELECT Name, Phone, PassengerType INTO v_name, v_phone, v_type
          FROM PASSENGER WHERE PassengerID = p_passenger_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20302, 'Passenger ' || p_passenger_id || ' not found.');
    END;

    DBMS_OUTPUT.PUT_LINE('=== REPORT 3: TRAVEL HISTORY ===');
    DBMS_OUTPUT.PUT_LINE('Passenger: ' || v_name || ' (' || p_passenger_id || ')  Phone: ' || v_phone
                         || '  Type: ' || v_type);
    DBMS_OUTPUT.PUT_LINE(RPAD('Ticket', 9) || RPAD('Trip date', 18) || RPAD('Journey', 40)
                         || RPAD('Vehicle', 10) || RPAD('Driver', 20) || LPAD('Seat', 5)
                         || LPAD('Fare', 10) || '  Status');
    DBMS_OUTPUT.PUT_LINE(RPAD('-', 122, '-'));

    FOR rec IN c_hist(p_passenger_id) LOOP
        v_rows := v_rows + 1;
        IF rec.Status = 'COMPLETED' THEN
            v_completed := v_completed + 1;
            v_fares := v_fares + rec.Fare;
        END IF;
        DBMS_OUTPUT.PUT_LINE(RPAD(rec.TicketID, 9)
                             || RPAD(TO_CHAR(rec.TripDate, 'YYYY-MM-DD HH24:MI'), 18)
                             || RPAD(SUBSTR(rec.journey, 1, 38), 40)
                             || RPAD(rec.RegistrationNo, 10)
                             || RPAD(SUBSTR(rec.driver_name, 1, 18), 20)
                             || LPAD(NVL(TO_CHAR(rec.SeatNo), '-'), 5)
                             || LPAD(TO_CHAR(rec.Fare, 'FM99,990.00'), 10)
                             || '  ' || rec.Status);
    END LOOP;

    IF v_rows = 0 THEN
        DBMS_OUTPUT.PUT_LINE('No travel history found for this passenger.');
    ELSE
        SELECT NVL(SUM(p.TotalAmount), 0) INTO v_sub_paid
          FROM STAFF_MONTHLY_PAYMENT m
          JOIN STAFF_SUBSCRIPTION s ON s.SubscriptionID = m.SubscriptionID
          JOIN PAYMENT p            ON p.PaymentID = m.PaymentID
         WHERE s.PassengerID = p_passenger_id AND p.PaymentStatus = 'PAID';

        DBMS_OUTPUT.PUT_LINE(RPAD('-', 122, '-'));
        DBMS_OUTPUT.PUT_LINE('Total tickets: ' || v_rows || '   Completed journeys: ' || v_completed
                             || '   On-demand fares (completed): ' || TO_CHAR(v_fares, 'FM999,990.00')
                             || '   Subscription payments: ' || TO_CHAR(v_sub_paid, 'FM999,990.00'));
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('ERROR in rpt_passenger_history: ' || SQLERRM);
        RAISE;
END rpt_passenger_history;
/

-- REPORT 4: Vehicles due (or overdue) for maintenance
CREATE OR REPLACE PROCEDURE rpt_vehicles_due_maintenance (
    p_days_ahead IN NUMBER DEFAULT 30
) IS
    v_rows PLS_INTEGER := 0;
    CURSOR c_due IS
        SELECT v.VehicleID, v.RegistrationNo, v.VehicleType, v.Status AS vehicle_status,
               m.ServiceDate AS last_service, m.NextServiceDate AS next_due,
               CASE WHEN m.NextServiceDate IS NULL THEN 'NEVER SERVICED'
                    WHEN m.NextServiceDate < TRUNC(SYSDATE) THEN 'OVERDUE'
                    ELSE 'DUE SOON' END AS urgency
          FROM VEHICLE v
          LEFT JOIN MAINTENANCE_RECORD m
                 ON m.VehicleID = v.VehicleID
                AND m.ServiceDate = (SELECT MAX(m2.ServiceDate)
                                       FROM MAINTENANCE_RECORD m2
                                      WHERE m2.VehicleID = v.VehicleID)
         WHERE v.Status <> 'RETIRED'
           AND (m.NextServiceDate IS NULL
                OR m.NextServiceDate <= TRUNC(SYSDATE) + p_days_ahead)
         ORDER BY m.NextServiceDate NULLS FIRST, v.VehicleID;
BEGIN
    IF p_days_ahead IS NULL OR p_days_ahead < 0 THEN
        RAISE_APPLICATION_ERROR(-20303, 'Days ahead must be zero or greater.');
    END IF;

    DBMS_OUTPUT.PUT_LINE('=== REPORT 4: VEHICLES DUE FOR MAINTENANCE (within ' || p_days_ahead || ' days) ===');
    DBMS_OUTPUT.PUT_LINE(RPAD('Vehicle', 9) || RPAD('Reg. no', 11) || RPAD('Type', 6)
                         || RPAD('Status', 19) || RPAD('Last service', 14)
                         || RPAD('Next due', 14) || RPAD('Days', 8) || 'Urgency');
    DBMS_OUTPUT.PUT_LINE(RPAD('-', 92, '-'));

    FOR rec IN c_due LOOP
        v_rows := v_rows + 1;
        DBMS_OUTPUT.PUT_LINE(RPAD(rec.VehicleID, 9) || RPAD(rec.RegistrationNo, 11)
                             || RPAD(rec.VehicleType, 6) || RPAD(rec.vehicle_status, 19)
                             || RPAD(NVL(TO_CHAR(rec.last_service, 'YYYY-MM-DD'), '-'), 14)
                             || RPAD(NVL(TO_CHAR(rec.next_due, 'YYYY-MM-DD'), '-'), 14)
                             || RPAD(NVL(TO_CHAR(TRUNC(rec.next_due) - TRUNC(SYSDATE)), '-'), 8)
                             || rec.urgency);
    END LOOP;

    IF v_rows = 0 THEN
        DBMS_OUTPUT.PUT_LINE('No vehicles are due for maintenance in this window.');
    ELSE
        DBMS_OUTPUT.PUT_LINE(v_rows || ' vehicle(s) need attention. (Negative days = days overdue)');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('ERROR in rpt_vehicles_due_maintenance: ' || SQLERRM);
        RAISE;
END rpt_vehicles_due_maintenance;
/

-- REPORT 5: Driver performance (trips and passenger ratings)
CREATE OR REPLACE PROCEDURE rpt_driver_performance (
    p_from IN DATE DEFAULT NULL,
    p_to   IN DATE DEFAULT NULL
) IS
    v_from DATE := TRUNC(NVL(p_from, DATE '1900-01-01'));
    v_to   DATE := TRUNC(NVL(p_to,   DATE '2999-12-31')) + 1;
    v_rows PLS_INTEGER := 0;
    CURSOR c_drivers IS
        SELECT d.DriverID, d.FullName, d.Status,
               COUNT(DISTINCT CASE WHEN t.Status = 'COMPLETED' THEN t.TripID END) AS completed_trips,
               COUNT(DISTINCT CASE WHEN t.Status = 'CANCELLED' THEN t.TripID END) AS cancelled_trips,
               COUNT(f.FeedbackID)  AS reviews,
               ROUND(AVG(f.Rating), 2) AS avg_rating
          FROM DRIVER d
          LEFT JOIN TRIP t     ON t.DriverID = d.DriverID
                              AND t.TripDate >= v_from AND t.TripDate < v_to
          LEFT JOIN FEEDBACK f ON f.TripID = t.TripID
         GROUP BY d.DriverID, d.FullName, d.Status
         ORDER BY avg_rating DESC NULLS LAST, completed_trips DESC, d.DriverID;
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== REPORT 5: DRIVER PERFORMANCE ===');
    DBMS_OUTPUT.PUT_LINE(RPAD('Driver', 8) || RPAD('Name', 24) || RPAD('Status', 10)
                         || LPAD('Completed', 11) || LPAD('Cancelled', 11)
                         || LPAD('Reviews', 9) || LPAD('Avg rating', 12));
    DBMS_OUTPUT.PUT_LINE(RPAD('-', 85, '-'));

    FOR rec IN c_drivers LOOP
        v_rows := v_rows + 1;
        DBMS_OUTPUT.PUT_LINE(RPAD(rec.DriverID, 8) || RPAD(SUBSTR(rec.FullName, 1, 22), 24)
                             || RPAD(rec.Status, 10)
                             || LPAD(rec.completed_trips, 11) || LPAD(rec.cancelled_trips, 11)
                             || LPAD(rec.reviews, 9)
                             || LPAD(NVL(TO_CHAR(rec.avg_rating, 'FM0.00'), 'n/a'), 12));
    END LOOP;

    IF v_rows = 0 THEN
        DBMS_OUTPUT.PUT_LINE('No drivers found.');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('ERROR in rpt_driver_performance: ' || SQLERRM);
        RAISE;
END rpt_driver_performance;
/

-- REPORT 6: Maintenance cost per vehicle
CREATE OR REPLACE PROCEDURE rpt_maintenance_cost (
    p_from IN DATE DEFAULT NULL,
    p_to   IN DATE DEFAULT NULL
) IS
    v_from  DATE := TRUNC(NVL(p_from, DATE '1900-01-01'));
    v_to    DATE := TRUNC(NVL(p_to,   DATE '2999-12-31')) + 1;
    v_grand NUMBER := 0;
    v_rows  PLS_INTEGER := 0;
    CURSOR c_cost IS
        SELECT v.VehicleID, v.RegistrationNo, v.VehicleType,
               COUNT(m.MaintenanceID)  AS services,
               NVL(SUM(m.Cost), 0)     AS total_cost,
               MAX(m.ServiceDate)      AS last_service
          FROM VEHICLE v
          LEFT JOIN MAINTENANCE_RECORD m
                 ON m.VehicleID = v.VehicleID
                AND m.ServiceDate >= v_from AND m.ServiceDate < v_to
         GROUP BY v.VehicleID, v.RegistrationNo, v.VehicleType
         ORDER BY total_cost DESC, v.VehicleID;
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== REPORT 6: MAINTENANCE COST BY VEHICLE ===');
    DBMS_OUTPUT.PUT_LINE(RPAD('Vehicle', 9) || RPAD('Reg. no', 11) || RPAD('Type', 6)
                         || LPAD('Services', 10) || LPAD('Total cost', 14) || '   Last service');
    DBMS_OUTPUT.PUT_LINE(RPAD('-', 62, '-'));

    FOR rec IN c_cost LOOP
        v_rows  := v_rows + 1;
        v_grand := v_grand + rec.total_cost;
        DBMS_OUTPUT.PUT_LINE(RPAD(rec.VehicleID, 9) || RPAD(rec.RegistrationNo, 11)
                             || RPAD(rec.VehicleType, 6) || LPAD(rec.services, 10)
                             || LPAD(TO_CHAR(rec.total_cost, 'FM999,990.00'), 14)
                             || '   ' || NVL(TO_CHAR(rec.last_service, 'YYYY-MM-DD'), '-'));
    END LOOP;

    DBMS_OUTPUT.PUT_LINE(RPAD('-', 62, '-'));
    DBMS_OUTPUT.PUT_LINE(RPAD('FLEET TOTAL', 36) || LPAD(TO_CHAR(v_grand, 'FM999,990.00'), 14));
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('ERROR in rpt_maintenance_cost: ' || SQLERRM);
        RAISE;
END rpt_maintenance_cost;
/

-- REPORT 7: Trip monitoring and seat utilisation
CREATE OR REPLACE PROCEDURE rpt_trip_utilisation (
    p_from IN DATE DEFAULT NULL,
    p_to   IN DATE DEFAULT NULL
) IS
    v_from DATE := TRUNC(NVL(p_from, DATE '1900-01-01'));
    v_to   DATE := TRUNC(NVL(p_to,   DATE '2999-12-31')) + 1;
    v_rows PLS_INTEGER := 0;
    CURSOR c_trips IS
        SELECT TripID, TripDate, Status, TripType, Journey, DriverName,
               RegistrationNo, SeatCapacity, SeatsBooked,
               ROUND(100 * SeatsBooked / SeatCapacity, 1) AS occupancy
          FROM VW_TRIP_MONITOR
         WHERE TripDate >= v_from AND TripDate < v_to
         ORDER BY TripDate;
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== REPORT 7: TRIP MONITORING AND SEAT UTILISATION ===');
    DBMS_OUTPUT.PUT_LINE(RPAD('Trip', 8) || RPAD('Date', 18) || RPAD('Status', 12)
                         || RPAD('Type', 15) || RPAD('Journey', 42) || RPAD('Driver', 18)
                         || RPAD('Vehicle', 10) || LPAD('Seats', 8) || LPAD('Occ %', 8));
    DBMS_OUTPUT.PUT_LINE(RPAD('-', 139, '-'));
 
    FOR rec IN c_trips LOOP
        v_rows := v_rows + 1;
        DBMS_OUTPUT.PUT_LINE(RPAD(rec.TripID, 8)
                             || RPAD(TO_CHAR(rec.TripDate, 'YYYY-MM-DD HH24:MI'), 18)
                             || RPAD(rec.Status, 12) || RPAD(rec.TripType, 15)
                             || RPAD(SUBSTR(rec.Journey, 1, 40), 42)
                             || RPAD(SUBSTR(rec.DriverName, 1, 16), 18)
                             || RPAD(rec.RegistrationNo, 10)
                             || LPAD(rec.SeatsBooked || '/' || rec.SeatCapacity, 8)
                             || LPAD(TO_CHAR(rec.occupancy, 'FM990.0'), 8));
    END LOOP;
 
    IF v_rows = 0 THEN
        DBMS_OUTPUT.PUT_LINE('No trips found in this period.');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('ERROR in rpt_trip_utilisation: ' || SQLERRM);
        RAISE;
END rpt_trip_utilisation;
/

-----------------------------------------------------------------------------------------------------------------------------------------------------------------
-- 8. SAMPLE DATA
--    Dates are relative to SYSDATE so the reports always show a
--    realistic mix of past, upcoming, overdue and due-soon records.

-- 8.1 Drivers ---------------------------------------------------------
INSERT INTO DRIVER (DriverID, FullName, LicenseNumber, Phone, HireDate, Status) VALUES ('DRV001', 'James Carter',    'LIC-B1234501', '555-0101', DATE '2019-03-15', 'ACTIVE');
INSERT INTO DRIVER (DriverID, FullName, LicenseNumber, Phone, HireDate, Status) VALUES ('DRV002', 'Maria Gonzalez',  'LIC-B1234502', '555-0102', DATE '2020-07-01', 'ACTIVE');
INSERT INTO DRIVER (DriverID, FullName, LicenseNumber, Phone, HireDate, Status) VALUES ('DRV003', 'Arjun Mehta',     'LIC-B1234503', '555-0103', DATE '2018-11-20', 'ACTIVE');
INSERT INTO DRIVER (DriverID, FullName, LicenseNumber, Phone, HireDate, Status) VALUES ('DRV004', 'Sophie Laurent',  'LIC-B1234504', '555-0104', DATE '2021-02-10', 'ACTIVE');
INSERT INTO DRIVER (DriverID, FullName, LicenseNumber, Phone, HireDate, Status) VALUES ('DRV005', 'David Okafor',    'LIC-B1234505', '555-0105', DATE '2017-05-30', 'ACTIVE');
INSERT INTO DRIVER (DriverID, FullName, LicenseNumber, Phone, HireDate, Status) VALUES ('DRV006', 'Aisha Rahman',    'LIC-B1234506', '555-0106', DATE '2022-08-22', 'ACTIVE');
INSERT INTO DRIVER (DriverID, FullName, LicenseNumber, Phone, HireDate, Status) VALUES ('DRV007', 'Liam O''Brien',   'LIC-B1234507', '555-0107', DATE '2023-01-09', 'ACTIVE');
INSERT INTO DRIVER (DriverID, FullName, LicenseNumber, Phone, HireDate, Status) VALUES ('DRV008', 'Chen Wei',        'LIC-B1234508', '555-0108', DATE '2016-09-12', 'ON_LEAVE');

-- 8.2 Vehicles and subtypes -------------------------------------------
INSERT INTO VEHICLE (VehicleID, RegistrationNo, VehicleType, SeatCapacity, Status, OwnerDriverID) VALUES ('VEH001', 'BUS-1001', 'BUS', 50, 'ACTIVE', NULL);
INSERT INTO VEHICLE (VehicleID, RegistrationNo, VehicleType, SeatCapacity, Status, OwnerDriverID) VALUES ('VEH002', 'BUS-1002', 'BUS', 50, 'ACTIVE', NULL);
INSERT INTO VEHICLE (VehicleID, RegistrationNo, VehicleType, SeatCapacity, Status, OwnerDriverID) VALUES ('VEH003', 'BUS-1003', 'BUS', 60, 'ACTIVE', NULL);
INSERT INTO VEHICLE (VehicleID, RegistrationNo, VehicleType, SeatCapacity, Status, OwnerDriverID) VALUES ('VEH004', 'BUS-1004', 'BUS', 45, 'ACTIVE', 'DRV002');
INSERT INTO VEHICLE (VehicleID, RegistrationNo, VehicleType, SeatCapacity, Status, OwnerDriverID) VALUES ('VEH005', 'BUS-1005', 'BUS', 45, 'UNDER_MAINTENANCE', NULL);
INSERT INTO VEHICLE (VehicleID, RegistrationNo, VehicleType, SeatCapacity, Status, OwnerDriverID) VALUES ('VEH006', 'VAN-2001', 'VAN', 12, 'ACTIVE', NULL);
INSERT INTO VEHICLE (VehicleID, RegistrationNo, VehicleType, SeatCapacity, Status, OwnerDriverID) VALUES ('VEH007', 'VAN-2002', 'VAN', 14, 'ACTIVE', 'DRV005');
INSERT INTO VEHICLE (VehicleID, RegistrationNo, VehicleType, SeatCapacity, Status, OwnerDriverID) VALUES ('VEH008', 'VAN-2003', 'VAN', 12, 'ACTIVE', NULL);

INSERT INTO BUS (VehicleID, NumberOfDecks, RatePerKm) VALUES ('VEH001', 1, 48.00);
INSERT INTO BUS (VehicleID, NumberOfDecks, RatePerKm) VALUES ('VEH002', 1, 50.00);
INSERT INTO BUS (VehicleID, NumberOfDecks, RatePerKm) VALUES ('VEH003', 2, 60.00);
INSERT INTO BUS (VehicleID, NumberOfDecks, RatePerKm) VALUES ('VEH004', 1, 45.00);
INSERT INTO BUS (VehicleID, NumberOfDecks, RatePerKm) VALUES ('VEH005', 1, 45.00);

INSERT INTO VAN (VehicleID, CargoSpaceM3, RatePerKm) VALUES ('VEH006', 4.50, 35.00);
INSERT INTO VAN (VehicleID, CargoSpaceM3, RatePerKm) VALUES ('VEH007', 5.00, 38.00);
INSERT INTO VAN (VehicleID, CargoSpaceM3, RatePerKm) VALUES ('VEH008', 4.00, 35.00);

-- 8.3 Routes and stops ------------------------------------------------
INSERT INTO ROUTE (RouteID, RouteName, TotalDistanceKm) VALUES ('RT001', 'Central Station - Tech Park',              18.50);
INSERT INTO ROUTE (RouteID, RouteName, TotalDistanceKm) VALUES ('RT002', 'Northern Suburbs - Business District',     24.00);
INSERT INTO ROUTE (RouteID, RouteName, TotalDistanceKm) VALUES ('RT003', 'Airport - City Centre',                    32.00);
INSERT INTO ROUTE (RouteID, RouteName, TotalDistanceKm) VALUES ('RT004', 'Harbour - Industrial Estate',              15.00);
INSERT INTO ROUTE (RouteID, RouteName, TotalDistanceKm) VALUES ('RT005', 'University - Central Station',             12.50);

INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT001', 1, 'Central Station');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT001', 2, 'Market Square');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT001', 3, 'Riverside Plaza');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT001', 4, 'Tech Park');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT002', 1, 'Northgate Terminal');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT002', 2, 'Elm Park');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT002', 3, 'City Hospital');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT002', 4, 'Business District');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT003', 1, 'Airport Terminal 1');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT003', 2, 'Expressway Junction');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT003', 3, 'Convention Centre');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT003', 4, 'City Centre');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT004', 1, 'Harbour Gate');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT004', 2, 'Fish Market');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT004', 3, 'Rail Depot');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT004', 4, 'Industrial Estate');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT005', 1, 'University Main Gate');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT005', 2, 'Library Junction');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT005', 3, 'Sports Complex');
INSERT INTO ROUTE_STOP (RouteID, StopSeqNo, StopName) VALUES ('RT005', 4, 'Central Station');

-- 8.4 Passengers ------------------------------------------------------
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS001', 'Emma Wilson',       '555-0201', 'emma.wilson@example.com',    'COMMUTER',  ADD_MONTHS(TRUNC(SYSDATE), -8));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS002', 'Raj Patel',         '555-0202', 'raj.patel@example.com',      'CORPORATE', ADD_MONTHS(TRUNC(SYSDATE), -8));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS003', 'Olivia Brown',      '555-0203', 'olivia.brown@example.com',   'COMMUTER',  ADD_MONTHS(TRUNC(SYSDATE), -7));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS004', 'Mohammed Al-Farsi', '555-0204', 'm.alfarsi@example.com',       'CORPORATE', ADD_MONTHS(TRUNC(SYSDATE), -7));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS005', 'Sofia Rossi',       '555-0205', 'sofia.rossi@example.com',    'COMMUTER',  ADD_MONTHS(TRUNC(SYSDATE), -6));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS006', 'Daniel Kim',        '555-0206', 'daniel.kim@example.com',     'CORPORATE', ADD_MONTHS(TRUNC(SYSDATE), -6));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS007', 'Grace Thompson',    '555-0207', 'grace.thompson@example.com', 'COMMUTER',  ADD_MONTHS(TRUNC(SYSDATE), -5));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS008', 'Lucas Martin',      '555-0208', 'lucas.martin@example.com',   'COMMUTER',  ADD_MONTHS(TRUNC(SYSDATE), -5));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS009', 'Nadia Hussain',     '555-0209', 'nadia.hussain@example.com',  'COMMUTER',  ADD_MONTHS(TRUNC(SYSDATE), -4));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS010', 'Ethan Clarke',      '555-0210', 'ethan.clarke@example.com',   'SPECIAL',   ADD_MONTHS(TRUNC(SYSDATE), -4));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS011', 'Isabella Costa',    '555-0211', 'isabella.costa@example.com', 'CORPORATE', ADD_MONTHS(TRUNC(SYSDATE), -3));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS012', 'Noah Fernando',     '555-0212', 'noah.fernando@example.com',  'COMMUTER',  ADD_MONTHS(TRUNC(SYSDATE), -3));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS013', 'Hannah Schmidt',    '555-0213', 'hannah.schmidt@example.com', 'COMMUTER',  ADD_MONTHS(TRUNC(SYSDATE), -2));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS014', 'Omar Haddad',       '555-0214', 'omar.haddad@example.com',    'CORPORATE', ADD_MONTHS(TRUNC(SYSDATE), -2));
INSERT INTO PASSENGER (PassengerID, Name, Phone, Email, PassengerType, RegisteredDate) VALUES ('PAS015', 'Chloe Dubois',      '555-0215', 'chloe.dubois@example.com',   'SPECIAL',   ADD_MONTHS(TRUNC(SYSDATE), -1));

-- 8.5 Staff subscriptions ---------------------------------------------
INSERT INTO STAFF_SUBSCRIPTION (SubscriptionID, PassengerID, RouteID, MonthlyBaseFare, StartDate, Status) VALUES ('SUB001', 'PAS001', 'RT001', 3000.00, ADD_MONTHS(TRUNC(SYSDATE), -6), 'ACTIVE');
INSERT INTO STAFF_SUBSCRIPTION (SubscriptionID, PassengerID, RouteID, MonthlyBaseFare, StartDate, Status) VALUES ('SUB002', 'PAS002', 'RT001', 3000.00, ADD_MONTHS(TRUNC(SYSDATE), -6), 'ACTIVE');
INSERT INTO STAFF_SUBSCRIPTION (SubscriptionID, PassengerID, RouteID, MonthlyBaseFare, StartDate, Status) VALUES ('SUB003', 'PAS003', 'RT002', 3600.00, ADD_MONTHS(TRUNC(SYSDATE), -5), 'ACTIVE');
INSERT INTO STAFF_SUBSCRIPTION (SubscriptionID, PassengerID, RouteID, MonthlyBaseFare, StartDate, Status) VALUES ('SUB004', 'PAS004', 'RT002', 3600.00, ADD_MONTHS(TRUNC(SYSDATE), -5), 'ACTIVE');
INSERT INTO STAFF_SUBSCRIPTION (SubscriptionID, PassengerID, RouteID, MonthlyBaseFare, StartDate, Status) VALUES ('SUB005', 'PAS005', 'RT003', 4200.00, ADD_MONTHS(TRUNC(SYSDATE), -4), 'ACTIVE');
INSERT INTO STAFF_SUBSCRIPTION (SubscriptionID, PassengerID, RouteID, MonthlyBaseFare, StartDate, Status) VALUES ('SUB006', 'PAS006', 'RT004', 2500.00, ADD_MONTHS(TRUNC(SYSDATE), -4), 'ACTIVE');
INSERT INTO STAFF_SUBSCRIPTION (SubscriptionID, PassengerID, RouteID, MonthlyBaseFare, StartDate, Status) VALUES ('SUB007', 'PAS007', 'RT005', 2200.00, ADD_MONTHS(TRUNC(SYSDATE), -3), 'ACTIVE');

-- 8.6 Trips -----------------------------------------------------------
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP001', TRUNC(SYSDATE) - 30 + 7/24,   'DRV001', 'VEH001', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP002', TRUNC(SYSDATE) - 30 + 17/24,  'DRV001', 'VEH001', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP003', TRUNC(SYSDATE) - 29 + 7/24,   'DRV002', 'VEH004', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP004', TRUNC(SYSDATE) - 25 + 7.5/24, 'DRV003', 'VEH002', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP005', TRUNC(SYSDATE) - 20 + 7/24,   'DRV001', 'VEH001', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP006', TRUNC(SYSDATE) - 20 + 7.5/24, 'DRV004', 'VEH003', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP007', TRUNC(SYSDATE) - 15 + 8/24,   'DRV002', 'VEH004', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP008', TRUNC(SYSDATE) - 10 + 7/24,   'DRV003', 'VEH002', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP009', TRUNC(SYSDATE) - 5 + 7/24,    'DRV001', 'VEH001', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP010', TRUNC(SYSDATE) + 2 + 7/24,    'DRV001', 'VEH001', 'SCHEDULED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP011', TRUNC(SYSDATE) + 3 + 7.5/24,  'DRV004', 'VEH003', 'SCHEDULED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP012', TRUNC(SYSDATE) + 5 + 8/24,    'DRV002', 'VEH004', 'SCHEDULED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP013', TRUNC(SYSDATE) - 28 + 10/24,  'DRV005', 'VEH007', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP014', TRUNC(SYSDATE) - 22 + 14/24,  'DRV006', 'VEH006', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP015', TRUNC(SYSDATE) - 18 + 9/24,   'DRV005', 'VEH007', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP016', TRUNC(SYSDATE) - 12 + 11/24,  'DRV006', 'VEH008', 'COMPLETED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP017', TRUNC(SYSDATE) - 7 + 16/24,   'DRV005', 'VEH007', 'CANCELLED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP018', TRUNC(SYSDATE) + 4 + 9/24,    'DRV006', 'VEH006', 'SCHEDULED');
INSERT INTO TRIP (TripID, TripDate, DriverID, VehicleID, Status) VALUES ('TRP019', TRUNC(SYSDATE) - 3 + 13/24,   'DRV007', 'VEH008', 'COMPLETED');

INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP001', 'RT001');
INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP002', 'RT001');
INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP003', 'RT002');
INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP004', 'RT003');
INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP005', 'RT001');
INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP006', 'RT004');
INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP007', 'RT002');
INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP008', 'RT005');
INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP009', 'RT001');
INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP010', 'RT001');
INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP011', 'RT004');
INSERT INTO STAFF_SERVICE_TRIP (TripID, RouteID) VALUES ('TRP012', 'RT002');

INSERT INTO ON_DEMAND_TRIP (TripID, Origin, Destination, EstimatedDistanceKm) VALUES ('TRP013', 'Airport',         'Grand Hotel',        28.00);
INSERT INTO ON_DEMAND_TRIP (TripID, Origin, Destination, EstimatedDistanceKm) VALUES ('TRP014', 'Central Station', 'Conference Centre',   9.50);
INSERT INTO ON_DEMAND_TRIP (TripID, Origin, Destination, EstimatedDistanceKm) VALUES ('TRP015', 'City Mall',       'Lakeside Resort',    45.00);
INSERT INTO ON_DEMAND_TRIP (TripID, Origin, Destination, EstimatedDistanceKm) VALUES ('TRP016', 'Tech Park',       'Airport',            30.00);
INSERT INTO ON_DEMAND_TRIP (TripID, Origin, Destination, EstimatedDistanceKm) VALUES ('TRP017', 'City Hospital',   'Riverside Clinic',    6.00);
INSERT INTO ON_DEMAND_TRIP (TripID, Origin, Destination, EstimatedDistanceKm) VALUES ('TRP018', 'Airport',         'Convention Hall',    26.00);
INSERT INTO ON_DEMAND_TRIP (TripID, Origin, Destination, EstimatedDistanceKm) VALUES ('TRP019', 'University',      'Sports Complex',     14.00);

-- 8.7 Tickets ---------------------------------------------------------
-- Staff-service tickets (covered by subscription, fare 0)
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT001', 'PAS001', 'TRP001', TRUNC(SYSDATE) - 31, 1, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT002', 'PAS002', 'TRP001', TRUNC(SYSDATE) - 31, 2, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT003', 'PAS001', 'TRP002', TRUNC(SYSDATE) - 31, 1, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT004', 'PAS002', 'TRP002', TRUNC(SYSDATE) - 31, 2, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT005', 'PAS003', 'TRP003', TRUNC(SYSDATE) - 30, 1, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT006', 'PAS004', 'TRP003', TRUNC(SYSDATE) - 30, 2, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT007', 'PAS005', 'TRP004', TRUNC(SYSDATE) - 26, 1, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT008', 'PAS001', 'TRP005', TRUNC(SYSDATE) - 21, 1, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT009', 'PAS002', 'TRP005', TRUNC(SYSDATE) - 21, 2, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT010', 'PAS006', 'TRP006', TRUNC(SYSDATE) - 21, 1, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT011', 'PAS003', 'TRP007', TRUNC(SYSDATE) - 16, 1, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT012', 'PAS004', 'TRP007', TRUNC(SYSDATE) - 16, 2, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT013', 'PAS007', 'TRP008', TRUNC(SYSDATE) - 11, 1, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT014', 'PAS001', 'TRP009', TRUNC(SYSDATE) - 6,  1, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT015', 'PAS002', 'TRP009', TRUNC(SYSDATE) - 6,  2, 0, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT016', 'PAS001', 'TRP010', TRUNC(SYSDATE) - 1,  1, 0, 'BOOKED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT017', 'PAS002', 'TRP010', TRUNC(SYSDATE) - 1,  2, 0, 'BOOKED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT018', 'PAS006', 'TRP011', TRUNC(SYSDATE) - 1,  1, 0, 'BOOKED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT019', 'PAS003', 'TRP012', TRUNC(SYSDATE) - 1,  1, 0, 'BOOKED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT020', 'PAS004', 'TRP012', TRUNC(SYSDATE) - 1,  NULL, 0, 'CANCELLED');

-- On-demand tickets (fare = distance x vehicle rate per km)
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT021', 'PAS008', 'TRP013', TRUNC(SYSDATE) - 29, 1, 1064.00, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT022', 'PAS009', 'TRP014', TRUNC(SYSDATE) - 23, 1,  332.50, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT023', 'PAS010', 'TRP015', TRUNC(SYSDATE) - 19, 1, 1710.00, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT024', 'PAS011', 'TRP016', TRUNC(SYSDATE) - 13, 1, 1050.00, 'COMPLETED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT025', 'PAS012', 'TRP017', TRUNC(SYSDATE) - 8,  NULL, 228.00, 'CANCELLED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT026', 'PAS013', 'TRP018', TRUNC(SYSDATE) - 1,  1,  910.00, 'BOOKED');
INSERT INTO TICKET (TicketID, PassengerID, TripID, BookingDate, SeatNo, Fare, Status) VALUES ('TKT027', 'PAS014', 'TRP019', TRUNC(SYSDATE) - 4,  1,  490.00, 'COMPLETED');

-- 8.8 Payments --------------------------------------------------------
-- Staff monthly bills: amount = MonthlyBaseFare + TotalDistanceKm x 8
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY001', 5960.00, ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -1) + 2, 'CARD',   'PAID');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY002', 5960.00, TRUNC(SYSDATE, 'MM'),                    'CARD',   'PAID');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY003', 5960.00, ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -1) + 3, 'ONLINE', 'PAID');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY004', 5664.00, TRUNC(SYSDATE, 'MM'),                    'ONLINE', 'PAID');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY005', 7440.00, ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -1) + 2, 'CARD',   'PAID');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY006', 7440.00, TRUNC(SYSDATE, 'MM'),                    'CARD',   'PAID');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY007', 9320.00, TRUNC(SYSDATE, 'MM'),                    'ONLINE', 'PAID');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY008', 4900.00, TRUNC(SYSDATE, 'MM'),                    'CASH',   'PAID');

INSERT INTO STAFF_MONTHLY_PAYMENT (PaymentID, SubscriptionID, BillingMonth, TotalDistanceKm) VALUES ('PAY001', 'SUB001', TO_CHAR(ADD_MONTHS(SYSDATE, -2), 'YYYY-MM'), 370.00);
INSERT INTO STAFF_MONTHLY_PAYMENT (PaymentID, SubscriptionID, BillingMonth, TotalDistanceKm) VALUES ('PAY002', 'SUB001', TO_CHAR(ADD_MONTHS(SYSDATE, -1), 'YYYY-MM'), 370.00);
INSERT INTO STAFF_MONTHLY_PAYMENT (PaymentID, SubscriptionID, BillingMonth, TotalDistanceKm) VALUES ('PAY003', 'SUB002', TO_CHAR(ADD_MONTHS(SYSDATE, -2), 'YYYY-MM'), 370.00);
INSERT INTO STAFF_MONTHLY_PAYMENT (PaymentID, SubscriptionID, BillingMonth, TotalDistanceKm) VALUES ('PAY004', 'SUB002', TO_CHAR(ADD_MONTHS(SYSDATE, -1), 'YYYY-MM'), 333.00);
INSERT INTO STAFF_MONTHLY_PAYMENT (PaymentID, SubscriptionID, BillingMonth, TotalDistanceKm) VALUES ('PAY005', 'SUB003', TO_CHAR(ADD_MONTHS(SYSDATE, -2), 'YYYY-MM'), 480.00);
INSERT INTO STAFF_MONTHLY_PAYMENT (PaymentID, SubscriptionID, BillingMonth, TotalDistanceKm) VALUES ('PAY006', 'SUB003', TO_CHAR(ADD_MONTHS(SYSDATE, -1), 'YYYY-MM'), 480.00);
INSERT INTO STAFF_MONTHLY_PAYMENT (PaymentID, SubscriptionID, BillingMonth, TotalDistanceKm) VALUES ('PAY007', 'SUB005', TO_CHAR(ADD_MONTHS(SYSDATE, -1), 'YYYY-MM'), 640.00);
INSERT INTO STAFF_MONTHLY_PAYMENT (PaymentID, SubscriptionID, BillingMonth, TotalDistanceKm) VALUES ('PAY008', 'SUB006', TO_CHAR(ADD_MONTHS(SYSDATE, -1), 'YYYY-MM'), 300.00);

-- On-demand payments (one per ticket)
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY009', 1064.00, TRUNC(SYSDATE) - 28, 'CARD',   'PAID');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY010',  332.50, TRUNC(SYSDATE) - 22, 'CASH',   'PAID');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY011', 1710.00, TRUNC(SYSDATE) - 18, 'ONLINE', 'PAID');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY012', 1050.00, TRUNC(SYSDATE) - 12, 'CARD',   'PAID');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY013',  228.00, TRUNC(SYSDATE) - 7,  'ONLINE', 'REFUNDED');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY014',  910.00, TRUNC(SYSDATE),      'ONLINE', 'PENDING');
INSERT INTO PAYMENT (PaymentID, TotalAmount, PaymentDate, PaymentMethod, PaymentStatus) VALUES ('PAY015',  490.00, TRUNC(SYSDATE) - 3,  'CASH',   'PAID');

INSERT INTO ON_DEMAND_PAYMENT (PaymentID, TicketID, DistanceKm) VALUES ('PAY009', 'TKT021', 28.00);
INSERT INTO ON_DEMAND_PAYMENT (PaymentID, TicketID, DistanceKm) VALUES ('PAY010', 'TKT022',  9.50);
INSERT INTO ON_DEMAND_PAYMENT (PaymentID, TicketID, DistanceKm) VALUES ('PAY011', 'TKT023', 45.00);
INSERT INTO ON_DEMAND_PAYMENT (PaymentID, TicketID, DistanceKm) VALUES ('PAY012', 'TKT024', 30.00);
INSERT INTO ON_DEMAND_PAYMENT (PaymentID, TicketID, DistanceKm) VALUES ('PAY013', 'TKT025',  6.00);
INSERT INTO ON_DEMAND_PAYMENT (PaymentID, TicketID, DistanceKm) VALUES ('PAY014', 'TKT026', 26.00);
INSERT INTO ON_DEMAND_PAYMENT (PaymentID, TicketID, DistanceKm) VALUES ('PAY015', 'TKT027', 14.00);

-- 8.9 Maintenance records (latest record per vehicle drives the "due" report)
INSERT INTO MAINTENANCE_RECORD (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate) VALUES ('MNT001', 'VEH001', TRUNC(SYSDATE) - 380,  820.00, 'ROUTINE',    'Annual service, oil and filter change',      TRUNC(SYSDATE) - 200);
INSERT INTO MAINTENANCE_RECORD (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate) VALUES ('MNT002', 'VEH001', TRUNC(SYSDATE) - 200,  850.00, 'ROUTINE',    'Six-month service and tyre rotation',        TRUNC(SYSDATE) - 20);
INSERT INTO MAINTENANCE_RECORD (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate) VALUES ('MNT003', 'VEH002', TRUNC(SYSDATE) - 180, 1500.00, 'REPAIR',     'Brake system repair',                        TRUNC(SYSDATE) - 5);
INSERT INTO MAINTENANCE_RECORD (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate) VALUES ('MNT004', 'VEH002', TRUNC(SYSDATE) - 60,   900.00, 'ROUTINE',    'Routine service',                            TRUNC(SYSDATE) + 20);
INSERT INTO MAINTENANCE_RECORD (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate) VALUES ('MNT005', 'VEH003', TRUNC(SYSDATE) - 210, 1100.00, 'ROUTINE',    'Double-deck full service',                   TRUNC(SYSDATE) - 30);
INSERT INTO MAINTENANCE_RECORD (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate) VALUES ('MNT006', 'VEH003', TRUNC(SYSDATE) - 30,   400.00, 'INSPECTION', 'Safety inspection passed',                  TRUNC(SYSDATE) + 150);
INSERT INTO MAINTENANCE_RECORD (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate) VALUES ('MNT007', 'VEH004', TRUNC(SYSDATE) - 170,  780.00, 'ROUTINE',    'Routine service',                            TRUNC(SYSDATE) + 10);
INSERT INTO MAINTENANCE_RECORD (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate) VALUES ('MNT008', 'VEH005', TRUNC(SYSDATE) - 2,  2500.00, 'REPAIR',     'Gearbox replacement (vehicle in workshop)',  TRUNC(SYSDATE) + 90);
INSERT INTO MAINTENANCE_RECORD (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate) VALUES ('MNT009', 'VEH006', TRUNC(SYSDATE) - 90,   500.00, 'ROUTINE',    'Routine service',                            TRUNC(SYSDATE) + 90);
INSERT INTO MAINTENANCE_RECORD (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate) VALUES ('MNT010', 'VEH007', TRUNC(SYSDATE) - 45,   520.00, 'ROUTINE',    'Routine service',                            TRUNC(SYSDATE) + 45);
INSERT INTO MAINTENANCE_RECORD (MaintenanceID, VehicleID, ServiceDate, Cost, MaintenanceType, Description, NextServiceDate) VALUES ('MNT011', 'VEH008', TRUNC(SYSDATE) - 365,  450.00, 'ROUTINE',    'Annual service',                             TRUNC(SYSDATE) - 185);

-- 8.10 Feedback -------------------------------------------------------
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK001', 'TRP001', 'PAS001', 5, 'Punctual and comfortable ride.',        TRUNC(SYSDATE) - 30);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK002', 'TRP001', 'PAS002', 4, 'Good service, slightly warm inside.',     TRUNC(SYSDATE) - 30);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK003', 'TRP003', 'PAS003', 3, 'Bus was crowded at the second stop.',    TRUNC(SYSDATE) - 29);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK004', 'TRP004', 'PAS005', 5, 'Smooth trip and friendly driver.',        TRUNC(SYSDATE) - 25);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK005', 'TRP005', 'PAS001', 4, 'On time again.',                         TRUNC(SYSDATE) - 20);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK006', 'TRP006', 'PAS006', 2, 'Departed 20 minutes late.',               TRUNC(SYSDATE) - 20);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK007', 'TRP007', 'PAS004', 4, 'Clean bus, good driving.',                TRUNC(SYSDATE) - 15);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK008', 'TRP008', 'PAS007', 5, 'Perfect for my morning lectures.',        TRUNC(SYSDATE) - 10);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK009', 'TRP009', 'PAS002', 3, 'Average trip, some traffic delay.',      TRUNC(SYSDATE) - 5);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK010', 'TRP013', 'PAS008', 5, 'Driver helped with luggage.',             TRUNC(SYSDATE) - 28);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK011', 'TRP014', 'PAS009', 4, 'Quick and easy booking.',                 TRUNC(SYSDATE) - 22);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK012', 'TRP015', 'PAS010', 5, 'Excellent accessible service.',           TRUNC(SYSDATE) - 18);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK013', 'TRP016', 'PAS011', 3, 'Van was a bit noisy.',                   TRUNC(SYSDATE) - 12);
INSERT INTO FEEDBACK (FeedbackID, TripID, PassengerID, Rating, Comments, FeedbackDate) VALUES ('FBK014', 'TRP019', 'PAS014', 4, 'Comfortable and on time.',                TRUNC(SYSDATE) - 3);

COMMIT;

-----------------------------------------------------------------------------------------------------------------------------------------------------------------
-- 10. DEMO / TEST BLOCK (optional - adds a few extra rows)
--     Exercises the procedures, the business rules and the error handling.


DECLARE
    v_pass   PASSENGER.PassengerID%TYPE;
    v_trip   TRIP.TripID%TYPE;
    v_ticket TICKET.TicketID%TYPE;
    v_pay    PAYMENT.PaymentID%TYPE;
    v_fb     FEEDBACK.FeedbackID%TYPE;
BEGIN
    DBMS_OUTPUT.PUT_LINE('--- Demo: register passenger, schedule on-demand trip, book and pay ---');
    pr_add_passenger('Test Rider', '555-0299', 'test.rider@example.com', 'COMMUTER', v_pass);
    DBMS_OUTPUT.PUT_LINE('Passenger created: ' || v_pass);

    pr_schedule_on_demand_trip(TRUNC(SYSDATE) + 7 + 10/24, 'DRV006', 'VEH006',
                               'Airport', 'Central Station', 26, v_trip);
    DBMS_OUTPUT.PUT_LINE('Trip scheduled: ' || v_trip
                         || '  free seats: ' || fn_available_seats(v_trip));

    pr_book_ticket(v_pass, v_trip, v_ticket);
    DBMS_OUTPUT.PUT_LINE('Ticket booked: ' || v_ticket
                         || '  free seats now: ' || fn_available_seats(v_trip));

    pr_pay_on_demand(v_ticket, 'CARD', v_pay);
    DBMS_OUTPUT.PUT_LINE('Payment recorded: ' || v_pay);

    DBMS_OUTPUT.PUT_LINE('--- Demo: expected business-rule errors ---');
    BEGIN
        pr_book_ticket(v_pass, 'TRP010', v_ticket);
    EXCEPTION
        WHEN OTHERS THEN DBMS_OUTPUT.PUT_LINE('Expected (no subscription): ' || SQLERRM);
    END;

    BEGIN
        pr_book_ticket(v_pass, 'TRP017', v_ticket);
    EXCEPTION
        WHEN OTHERS THEN DBMS_OUTPUT.PUT_LINE('Expected (trip cancelled): ' || SQLERRM);
    END;

    BEGIN
        pr_add_feedback('TRP010', 'PAS001', 5, 'Too early to review', v_fb);
    EXCEPTION
        WHEN OTHERS THEN DBMS_OUTPUT.PUT_LINE('Expected (trip not completed): ' || SQLERRM);
    END;

    BEGIN
        pr_schedule_staff_trip(TRUNC(SYSDATE) + 9 + 7/24, 'DRV008', 'VEH001', 'RT001', v_trip);
    EXCEPTION
        WHEN OTHERS THEN DBMS_OUTPUT.PUT_LINE('Expected (driver on leave): ' || SQLERRM);
    END;

    DBMS_OUTPUT.PUT_LINE('--- Demo: cancel the ticket (payment is refunded) ---');
    pr_cancel_ticket(v_ticket);
    DBMS_OUTPUT.PUT_LINE('Ticket ' || v_ticket || ' cancelled.');
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Demo block failed: ' || SQLERRM);
        ROLLBACK;
END;
/

-- Run all reports ------------------------------------------------------

SET SERVEROUTPUT ON;

BEGIN rpt_route_popularity; END;
/
BEGIN rpt_revenue(TRUNC(SYSDATE) - 90, TRUNC(SYSDATE)); END;
/
BEGIN rpt_passenger_history('PAS001'); END;
/
BEGIN rpt_vehicles_due_maintenance(30); END;
/
BEGIN rpt_driver_performance; END;
/
BEGIN rpt_maintenance_cost; END;
/
BEGIN rpt_trip_utilisation; END;
/

-- Row-count verification ----------------------------------------------
SELECT 'DRIVER' AS table_name, COUNT(*) AS row_count FROM DRIVER
UNION ALL SELECT 'VEHICLE',               COUNT(*) FROM VEHICLE
UNION ALL SELECT 'BUS',                   COUNT(*) FROM BUS
UNION ALL SELECT 'VAN',                   COUNT(*) FROM VAN
UNION ALL SELECT 'ROUTE',                 COUNT(*) FROM ROUTE
UNION ALL SELECT 'ROUTE_STOP',            COUNT(*) FROM ROUTE_STOP
UNION ALL SELECT 'PASSENGER',             COUNT(*) FROM PASSENGER
UNION ALL SELECT 'STAFF_SUBSCRIPTION',    COUNT(*) FROM STAFF_SUBSCRIPTION
UNION ALL SELECT 'TRIP',                  COUNT(*) FROM TRIP
UNION ALL SELECT 'STAFF_SERVICE_TRIP',    COUNT(*) FROM STAFF_SERVICE_TRIP
UNION ALL SELECT 'ON_DEMAND_TRIP',        COUNT(*) FROM ON_DEMAND_TRIP
UNION ALL SELECT 'TICKET',                COUNT(*) FROM TICKET
UNION ALL SELECT 'PAYMENT',               COUNT(*) FROM PAYMENT
UNION ALL SELECT 'ON_DEMAND_PAYMENT',     COUNT(*) FROM ON_DEMAND_PAYMENT
UNION ALL SELECT 'STAFF_MONTHLY_PAYMENT', COUNT(*) FROM STAFF_MONTHLY_PAYMENT
UNION ALL SELECT 'MAINTENANCE_RECORD',    COUNT(*) FROM MAINTENANCE_RECORD
UNION ALL SELECT 'FEEDBACK',              COUNT(*) FROM FEEDBACK
UNION ALL SELECT 'AUDIT_LOG',             COUNT(*) FROM AUDIT_LOG;

COMMIT;
