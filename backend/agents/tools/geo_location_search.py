"""
Geo-location search tool for the immigration chatbot agent.

This tool fetches resources like legal help centers, medical centers, etc based on the type
of resources best suited to the user's query within the vicinity of the user.

TODO: MOCK IMPLEMENTATION - Replace with real database/API integration
This currently returns hardcoded mock data for 4 Arizona cities only:
- Tempe
- Scottsdale
- Chandler
- Gilbert

Future implementation should:
1. Replace MOCK_RESOURCES_BY_CITY with database queries
2. Use geocoding API instead of ZIP_TO_CITY mapping
3. Implement actual distance calculations with search_radius
4. Support all US cities and states
"""

from strands import tool
from typing import Optional, List, Dict, Any
import json


# TODO: Replace with geocoding API (e.g., Google Maps, Mapbox)
ZIP_TO_CITY = {
    # Tempe ZIP codes (verified)
    "85281": "tempe",
    "85282": "tempe",
    "85283": "tempe",
    "85284": "tempe",
    "85285": "tempe",  # PO Box
    "85287": "tempe",  # Arizona State University
    # Scottsdale ZIP codes (verified)
    "85250": "scottsdale",
    "85251": "scottsdale",
    "85253": "scottsdale",  # Also covers Paradise Valley
    "85254": "scottsdale",
    "85255": "scottsdale",
    "85256": "scottsdale",
    "85257": "scottsdale",
    "85258": "scottsdale",
    "85259": "scottsdale",
    "85260": "scottsdale",
    "85262": "scottsdale",
    "85266": "scottsdale",
    "85280": "scottsdale", 
    # Chandler ZIP codes (verified)
    "85224": "chandler",
    "85225": "chandler",
    "85226": "chandler",
    "85248": "chandler",  # Also covers Sun Lakes
    "85249": "chandler",
    "85286": "chandler",
    # Gilbert ZIP codes (verified)
    "85233": "gilbert",
    "85234": "gilbert",
    "85295": "gilbert",
    "85296": "gilbert",
    "85297": "gilbert",
    "85298": "gilbert",
}


# TODO: Replace with database queries filtered by actual geographic coordinates and distance
MOCK_RESOURCES_BY_CITY = {
    "tempe": {
        "Community Activities": [
            {
                "id": "tempe_ca_001",
                "name": "Tempe Community Center",
                "address": "3500 S Rural Rd, Tempe, AZ 85282",
                "phone": "(480) 350-5200",
                "website": "https://www.tempegov.org/community",
                "additional_notes": "ESL classes, cultural events, and family activities. Open Mon-Fri 8am-8pm."
            },
            {
                "id": "tempe_ca_002",
                "name": "International Friendship Center",
                "address": "1201 E Apache Blvd, Tempe, AZ 85281",
                "phone": "(480) 967-4567",
                "website": "https://www.friendshiptempe.org",
                "additional_notes": "Weekly conversation circles, cultural exchange programs, and social gatherings."
            },
        ],
        "Education Services": [
            {
                "id": "tempe_ed_001",
                "name": "Tempe Adult Education Center",
                "address": "1825 E University Dr, Tempe, AZ 85281",
                "phone": "(480) 730-7700",
                "website": "https://www.tuhsd.org/adulted",
                "additional_notes": "Free ESL classes, GED preparation, citizenship classes. Evening classes available."
            },
            {
                "id": "tempe_ed_002",
                "name": "Literacy Volunteers of Maricopa County - Tempe",
                "address": "3600 S McClintock Dr, Tempe, AZ 85282",
                "phone": "(480) 377-8900",
                "website": "https://www.literacyvolunteers.org",
                "additional_notes": "One-on-one tutoring, family literacy programs, and computer skills training."
            },
            {
                "id": "tempe_ed_003",
                "name": "ASU Educational Outreach",
                "address": "411 N Central Ave, Tempe, AZ 85281",
                "phone": "(480) 965-3333",
                "website": "https://www.asu.edu/outreach",
                "additional_notes": "Career counseling, college prep, and workforce development programs."
            },
        ],
        "Legal Services": [
            {
                "id": "tempe_ls_001",
                "name": "Community Legal Services - Tempe Office",
                "address": "305 S 2nd Ave, Tempe, AZ 85281",
                "phone": "(480) 634-9590",
                "website": "https://www.clsaz.org",
                "additional_notes": "Free legal aid for immigration, housing, and family law matters. Walk-ins welcome Mon-Thu."
            },
            {
                "id": "tempe_ls_002",
                "name": "Immigration Law Center of Tempe",
                "address": "1955 W Guadalupe Rd Suite 101, Tempe, AZ 85283",
                "phone": "(480) 456-7800",
                "website": "https://www.ilctempe.org",
                "additional_notes": "Asylum applications, green card renewals, citizenship assistance. Sliding scale fees."
            },
        ],
        "Medical Services": [
            {
                "id": "tempe_ms_001",
                "name": "Tempe Community Health Center",
                "address": "2055 E Southern Ave, Tempe, AZ 85282",
                "phone": "(480) 967-9281",
                "website": "https://www.tempehealthcenter.org",
                "additional_notes": "Primary care, dental, and behavioral health. Accepts patients without insurance."
            },
            {
                "id": "tempe_ms_002",
                "name": "Family Healthcare Center - Tempe",
                "address": "1717 W Broadway Rd, Tempe, AZ 85282",
                "phone": "(480) 344-2000",
                "website": "https://www.familyhealthcareaz.org",
                "additional_notes": "Pediatrics, prenatal care, and immunizations. Spanish-speaking staff available."
            },
            {
                "id": "tempe_ms_003",
                "name": "Tempe St. Luke's Health Center",
                "address": "1500 S Mill Ave Suite 201, Tempe, AZ 85281",
                "phone": "(480) 784-5500",
                "website": "https://www.dignityhealth.org",
                "additional_notes": "Walk-in urgent care and family medicine. Open 7 days a week."
            },
        ],
        "Mental Health Services": [
            {
                "id": "tempe_mh_001",
                "name": "Counseling & Consultation - Tempe",
                "address": "60 E Rio Salado Pkwy Suite 900, Tempe, AZ 85281",
                "phone": "(480) 921-9400",
                "website": "https://www.tempecounseling.org",
                "additional_notes": "Individual and family therapy, trauma counseling. Sliding scale fees available."
            },
            {
                "id": "tempe_mh_002",
                "name": "Refugee Mental Wellness Center",
                "address": "2150 E Broadway Rd Suite 110, Tempe, AZ 85282",
                "phone": "(480) 555-0901",
                "website": "https://www.refugeewellness.org",
                "additional_notes": "Culturally sensitive mental health services, PTSD treatment, support groups."
            },
        ],
        "Refugee Resettlement Agencies": [
            {
                "id": "tempe_rr_001",
                "name": "Arizona Resettlement Agency - Tempe Office",
                "address": "1840 E Warner Rd Suite A-103, Tempe, AZ 85284",
                "phone": "(480) 902-9700",
                "website": "https://www.azresettlement.org",
                "additional_notes": "Comprehensive resettlement services, employment assistance, and case management."
            },
            {
                "id": "tempe_rr_002",
                "name": "International Rescue Committee - Phoenix (serves Tempe)",
                "address": "1453 E McDowell Rd, Tempe, AZ 85281",
                "phone": "(602) 433-2440",
                "website": "https://www.rescue.org/phoenix",
                "additional_notes": "Refugee resettlement, job placement, and youth programs."
            },
            {
                "id": "tempe_rr_003",
                "name": "Arizona Refugee Resettlement Program",
                "address": "2901 S Mill Ave Suite 120, Tempe, AZ 85282",
                "phone": "(480) 377-1500",
                "website": "https://www.azrefugee.org",
                "additional_notes": "Housing assistance, cultural orientation, and community integration services."
            },
        ],
        "Other Assistance": [
            {
                "id": "tempe_oa_001",
                "name": "Tempe Community Action Agency",
                "address": "2146 E Apache Blvd, Tempe, AZ 85281",
                "phone": "(480) 350-5750",
                "website": "https://www.tempecaa.org",
                "additional_notes": "Emergency food, utility assistance, and rental assistance programs."
            },
            {
                "id": "tempe_oa_002",
                "name": "United Food Bank - Tempe Distribution",
                "address": "245 S Nina Dr, Tempe, AZ 85281",
                "phone": "(480) 398-5353",
                "website": "https://www.unitedfoodbank.org",
                "additional_notes": "Food distribution Wed & Fri 9am-12pm. No ID required."
            },
        ],
    },
    "scottsdale": {
        "Community Activities": [
            {
                "id": "scottsdale_ca_001",
                "name": "Scottsdale Cultural Council",
                "address": "7380 E 2nd St, Scottsdale, AZ 85251",
                "phone": "(480) 874-4610",
                "website": "https://www.scottsdaleart.org",
                "additional_notes": "Cultural workshops, international events, and community gatherings."
            },
            {
                "id": "scottsdale_ca_002",
                "name": "Paiute Neighborhood Center",
                "address": "6535 E Osborn Rd, Scottsdale, AZ 85251",
                "phone": "(480) 312-2338",
                "website": "https://www.scottsdaleaz.gov/paiute",
                "additional_notes": "Recreation programs, ESL classes, and family activities."
            },
        ],
        "Education Services": [
            {
                "id": "scottsdale_ed_001",
                "name": "Scottsdale Community College Adult Education",
                "address": "9000 E Chaparral Rd, Scottsdale, AZ 85256",
                "phone": "(480) 423-6000",
                "website": "https://www.scottsdalecc.edu/adulted",
                "additional_notes": "ESL classes, GED prep, and vocational training. Day and evening classes."
            },
            {
                "id": "scottsdale_ed_002",
                "name": "Scottsdale Public Library Learning Center",
                "address": "3839 N Drinkwater Blvd, Scottsdale, AZ 85251",
                "phone": "(480) 312-2474",
                "website": "https://www.scottsdaleaz.gov/library",
                "additional_notes": "Computer literacy, job search assistance, and citizenship preparation."
            },
            {
                "id": "scottsdale_ed_003",
                "name": "New Pathways Education Center",
                "address": "7575 E Main St Suite 200, Scottsdale, AZ 85251",
                "phone": "(480) 945-6543",
                "website": "https://www.newpathwaysed.org",
                "additional_notes": "Academic counseling, scholarship info, and career development services."
            },
        ],
        "Legal Services": [
            {
                "id": "scottsdale_ls_001",
                "name": "Scottsdale Immigration Legal Services",
                "address": "8687 E Via de Ventura Suite 214, Scottsdale, AZ 85258",
                "phone": "(480) 368-9090",
                "website": "https://www.scottsdaleimmigration.org",
                "additional_notes": "Immigration consultations, visa applications, and family reunification."
            },
            {
                "id": "scottsdale_ls_002",
                "name": "Legal Aid Clinic of Scottsdale",
                "address": "4400 N Scottsdale Rd Suite 300, Scottsdale, AZ 85251",
                "phone": "(480) 675-7700",
                "website": "https://www.legalaidscottsdale.org",
                "additional_notes": "Pro bono legal services for low-income families. Appointments required."
            },
        ],
        "Medical Services": [
            {
                "id": "scottsdale_ms_001",
                "name": "Scottsdale Healthcare Center",
                "address": "7400 E Osborn Rd, Scottsdale, AZ 85251",
                "phone": "(480) 882-4000",
                "website": "https://www.scottsdalehealthcare.org",
                "additional_notes": "Primary care, urgent care, and specialty services. Multilingual staff."
            },
            {
                "id": "scottsdale_ms_002",
                "name": "Community Health Services - Scottsdale",
                "address": "10229 N 92nd St Suite 102, Scottsdale, AZ 85258",
                "phone": "(480) 344-5555",
                "website": "https://www.chsaz.org",
                "additional_notes": "Family medicine, pediatrics, and immunizations. Sliding scale available."
            },
            {
                "id": "scottsdale_ms_003",
                "name": "Scottsdale Family Health Clinic",
                "address": "3033 N Civic Center Plaza, Scottsdale, AZ 85251",
                "phone": "(480) 312-7955",
                "website": "https://www.scottsdalefamilyhealth.org",
                "additional_notes": "Walk-in clinic services, no appointment needed. Accepts uninsured patients."
            },
        ],
        "Mental Health Services": [
            {
                "id": "scottsdale_mh_001",
                "name": "Scottsdale Behavioral Health",
                "address": "7330 E Butherus Dr, Scottsdale, AZ 85260",
                "phone": "(480) 878-8888",
                "website": "https://www.scottsdalehealth.org",
                "additional_notes": "Therapy, counseling, and psychiatric services. Crisis intervention available."
            },
            {
                "id": "scottsdale_mh_002",
                "name": "Cultural Counseling Center",
                "address": "8426 E Shea Blvd Suite 100, Scottsdale, AZ 85260",
                "phone": "(480) 284-9100",
                "website": "https://www.culturalcounseling.org",
                "additional_notes": "Trauma therapy, family counseling, and support groups in multiple languages."
            },
        ],
        "Refugee Resettlement Agencies": [
            {
                "id": "scottsdale_rr_001",
                "name": "Refugee Focus - Scottsdale Office",
                "address": "14850 N Scottsdale Rd Suite 160, Scottsdale, AZ 85254",
                "phone": "(480) 585-3700",
                "website": "https://www.refugeefocus.org",
                "additional_notes": "Employment services, housing assistance, and integration support."
            },
            {
                "id": "scottsdale_rr_002",
                "name": "Arizona Resettlement Services",
                "address": "7333 E Scottsdale Mall, Scottsdale, AZ 85251",
                "phone": "(480) 425-9090",
                "website": "https://www.azresettlement.org",
                "additional_notes": "Case management, job training, and community orientation."
            },
            {
                "id": "scottsdale_rr_003",
                "name": "New Americans Center - Scottsdale",
                "address": "8170 E Indian School Rd Suite 100, Scottsdale, AZ 85251",
                "phone": "(480) 990-1122",
                "website": "https://www.newamericans.org",
                "additional_notes": "Comprehensive resettlement support and family services."
            },
        ],
        "Other Assistance": [
            {
                "id": "scottsdale_oa_001",
                "name": "Scottsdale Assistance League",
                "address": "8222 E McDowell Rd, Scottsdale, AZ 85257",
                "phone": "(480) 874-0648",
                "website": "https://www.assistanceleague.org",
                "additional_notes": "Emergency assistance, clothing, and school supplies."
            },
            {
                "id": "scottsdale_oa_002",
                "name": "Desert Mission Food Bank - Scottsdale",
                "address": "10617 N Scottsdale Rd Suite 100, Scottsdale, AZ 85254",
                "phone": "(480) 998-6340",
                "website": "https://www.desertmission.org",
                "additional_notes": "Food pantry open Tues & Thurs 10am-1pm. Housing assistance referrals."
            },
        ],
    },
    "chandler": {
        "Community Activities": [
            {
                "id": "chandler_ca_001",
                "name": "Chandler Community Center",
                "address": "125 E Commonwealth Ave, Chandler, AZ 85225",
                "phone": "(480) 782-2727",
                "website": "https://www.chandleraz.gov/community",
                "additional_notes": "Cultural programs, language exchange, and family events."
            },
            {
                "id": "chandler_ca_002",
                "name": "Multicultural Center of Chandler",
                "address": "1777 W Chandler Blvd, Chandler, AZ 85224",
                "phone": "(480) 855-4444",
                "website": "https://www.multiculturalchandler.org",
                "additional_notes": "International festivals, community gatherings, and cultural workshops."
            },
        ],
        "Education Services": [
            {
                "id": "chandler_ed_001",
                "name": "Chandler-Gilbert Community College Adult Ed",
                "address": "2626 E Pecos Rd, Chandler, AZ 85225",
                "phone": "(480) 732-7000",
                "website": "https://www.cgc.edu/adulted",
                "additional_notes": "ESL classes, GED preparation, and career training programs."
            },
            {
                "id": "chandler_ed_002",
                "name": "Chandler Public Library Literacy Program",
                "address": "2500 N Arizona Ave, Chandler, AZ 85225",
                "phone": "(480) 782-2800",
                "website": "https://www.chandlerlibrary.org",
                "additional_notes": "Free tutoring, computer classes, and citizenship test prep."
            },
            {
                "id": "chandler_ed_003",
                "name": "Chandler Education Foundation",
                "address": "1525 W Frye Rd Suite 101, Chandler, AZ 85224",
                "phone": "(480) 812-7777",
                "website": "https://www.chandlereducation.org",
                "additional_notes": "Scholarship assistance, mentoring, and academic support services."
            },
        ],
        "Legal Services": [
            {
                "id": "chandler_ls_001",
                "name": "Chandler Legal Aid Center",
                "address": "88 E Chicago St Suite 200, Chandler, AZ 85225",
                "phone": "(480) 899-3939",
                "website": "https://www.chandlerlegalaid.org",
                "additional_notes": "Immigration law, family law, and housing assistance. Free consultations."
            },
            {
                "id": "chandler_ls_002",
                "name": "Valley Immigration Law - Chandler",
                "address": "2929 W Frye Rd Suite 160, Chandler, AZ 85224",
                "phone": "(480) 855-7575",
                "website": "https://www.valleyimmigration.org",
                "additional_notes": "Asylum, citizenship, and visa services. Payment plans available."
            },
        ],
        "Medical Services": [
            {
                "id": "chandler_ms_001",
                "name": "Chandler Regional Medical Center Clinic",
                "address": "1955 W Frye Rd, Chandler, AZ 85224",
                "phone": "(480) 728-3000",
                "website": "https://www.chandlerregional.org",
                "additional_notes": "Primary care, urgent care, and specialty services. Spanish speakers on staff."
            },
            {
                "id": "chandler_ms_002",
                "name": "Chandler Community Health Center",
                "address": "450 S Arizona Ave, Chandler, AZ 85225",
                "phone": "(480) 963-4231",
                "website": "https://www.chandlerhealth.org",
                "additional_notes": "Family medicine, pediatrics, and dental care. Sliding scale fees."
            },
            {
                "id": "chandler_ms_003",
                "name": "East Valley Family Health",
                "address": "3100 S Price Rd Suite 102, Chandler, AZ 85248",
                "phone": "(480) 786-5555",
                "website": "https://www.eastvalleyfamilyhealth.org",
                "additional_notes": "Walk-in and appointment-based care. Accepts uninsured patients."
            },
        ],
        "Mental Health Services": [
            {
                "id": "chandler_mh_001",
                "name": "Chandler Counseling Center",
                "address": "1950 W Chandler Blvd Suite 5, Chandler, AZ 85224",
                "phone": "(480) 899-2345",
                "website": "https://www.chandlercounseling.org",
                "additional_notes": "Individual therapy, family counseling, and trauma treatment."
            },
            {
                "id": "chandler_mh_002",
                "name": "Hope & Healing Center - Chandler",
                "address": "6750 S Alma School Rd Suite 100, Chandler, AZ 85286",
                "phone": "(480) 722-8899",
                "website": "https://www.hopeandhealing.org",
                "additional_notes": "Mental health services for refugees and immigrants. Bilingual therapists."
            },
        ],
        "Refugee Resettlement Agencies": [
            {
                "id": "chandler_rr_001",
                "name": "Arizona Resettlement Agency - Chandler Office",
                "address": "3111 W Chandler Blvd Suite 2040, Chandler, AZ 85226",
                "phone": "(480) 963-8800",
                "website": "https://www.azresettlement.org",
                "additional_notes": "Full resettlement services, job placement, and housing assistance."
            },
            {
                "id": "chandler_rr_002",
                "name": "Chandler Refugee Services",
                "address": "1810 E Queen Creek Rd Suite 4, Chandler, AZ 85286",
                "phone": "(480) 855-9999",
                "website": "https://www.chandlerrefugee.org",
                "additional_notes": "Case management, employment support, and community integration."
            },
            {
                "id": "chandler_rr_003",
                "name": "New Life Resettlement Agency",
                "address": "800 N 54th St Suite 101, Chandler, AZ 85226",
                "phone": "(480) 917-4567",
                "website": "https://www.newliferesettlement.org",
                "additional_notes": "Cultural orientation, ESL referrals, and family support services."
            },
        ],
        "Other Assistance": [
            {
                "id": "chandler_oa_001",
                "name": "Chandler CARE Center",
                "address": "120 S Dakota St, Chandler, AZ 85225",
                "phone": "(480) 963-3659",
                "website": "https://www.chandlercarecenter.org",
                "additional_notes": "Emergency food, clothing, and utility assistance. Walk-ins welcome."
            },
            {
                "id": "chandler_oa_002",
                "name": "East Valley Housing Coalition",
                "address": "1855 E Baseline Rd Suite 101, Chandler, AZ 85225",
                "phone": "(480) 833-7788",
                "website": "https://www.evhousing.org",
                "additional_notes": "Rental assistance applications, housing search help, and tenant education."
            },
        ],
    },
    "gilbert": {
        "Community Activities": [
            {
                "id": "gilbert_ca_001",
                "name": "Gilbert Community Center",
                "address": "50 E Civic Center Dr, Gilbert, AZ 85296",
                "phone": "(480) 503-6200",
                "website": "https://www.gilbertaz.gov/community",
                "additional_notes": "Recreation programs, cultural events, and community classes."
            },
            {
                "id": "gilbert_ca_002",
                "name": "Gilbert Global Center",
                "address": "2544 E Baseline Rd, Gilbert, AZ 85234",
                "phone": "(480) 503-7777",
                "website": "https://www.gilbertglobal.org",
                "additional_notes": "International community programs, language exchange, and social activities."
            },
        ],
        "Education Services": [
            {
                "id": "gilbert_ed_001",
                "name": "Gilbert Adult Education Center",
                "address": "628 E Elliot Rd, Gilbert, AZ 85234",
                "phone": "(480) 497-0700",
                "website": "https://www.gilbertschools.net/adulted",
                "additional_notes": "ESL classes, GED prep, and high school equivalency programs."
            },
            {
                "id": "gilbert_ed_002",
                "name": "Gilbert Public Library Learning Lab",
                "address": "4725 E Germann Rd, Gilbert, AZ 85297",
                "phone": "(480) 497-2600",
                "website": "https://www.gilbertaz.gov/library",
                "additional_notes": "Computer training, job skills workshops, and citizenship resources."
            },
            {
                "id": "gilbert_ed_003",
                "name": "East Valley Institute for Education",
                "address": "1955 E Brown Rd Suite 101, Gilbert, AZ 85296",
                "phone": "(480) 899-6666",
                "website": "https://www.evieducation.org",
                "additional_notes": "Career counseling, vocational training, and scholarship information."
            },
        ],
        "Legal Services": [
            {
                "id": "gilbert_ls_001",
                "name": "Gilbert Immigration Legal Center",
                "address": "1920 E Williams Field Rd Suite 110, Gilbert, AZ 85295",
                "phone": "(480) 926-8080",
                "website": "https://www.gilbertimmigration.org",
                "additional_notes": "Immigration consultations, naturalization, and family petitions."
            },
            {
                "id": "gilbert_ls_002",
                "name": "East Valley Legal Aid",
                "address": "3210 S Gilbert Rd Suite 4, Gilbert, AZ 85297",
                "phone": "(480) 633-7070",
                "website": "https://www.evlegalaid.org",
                "additional_notes": "Free legal services for low-income residents. Call for appointment."
            },
        ],
        "Medical Services": [
            {
                "id": "gilbert_ms_001",
                "name": "Mercy Gilbert Medical Center Clinic",
                "address": "3555 S Val Vista Dr, Gilbert, AZ 85297",
                "phone": "(480) 728-8888",
                "website": "https://www.mercygilbert.org",
                "additional_notes": "Primary care, urgent care, and preventive health services."
            },
            {
                "id": "gilbert_ms_002",
                "name": "Gilbert Family Health Services",
                "address": "902 E Warner Rd Suite 7, Gilbert, AZ 85296",
                "phone": "(480) 503-3333",
                "website": "https://www.gilbertfamilyhealth.org",
                "additional_notes": "Family medicine, pediatrics, and women's health. Multilingual staff."
            },
            {
                "id": "gilbert_ms_003",
                "name": "Community Health Center of Gilbert",
                "address": "1955 E Guadalupe Rd Suite 103, Gilbert, AZ 85234",
                "phone": "(480) 857-4545",
                "website": "https://www.chcgilbert.org",
                "additional_notes": "Affordable healthcare for uninsured and underinsured families."
            },
        ],
        "Mental Health Services": [
            {
                "id": "gilbert_mh_001",
                "name": "Gilbert Counseling & Wellness",
                "address": "2730 S Val Vista Dr Suite 171, Gilbert, AZ 85295",
                "phone": "(480) 855-5656",
                "website": "https://www.gilbertcounseling.org",
                "additional_notes": "Therapy, counseling, and crisis support. Evening appointments available."
            },
            {
                "id": "gilbert_mh_002",
                "name": "Crossroads Mental Health - Gilbert",
                "address": "910 W Elliot Rd Suite 104, Gilbert, AZ 85233",
                "phone": "(480) 926-9292",
                "website": "https://www.crossroadsmentalhealth.org",
                "additional_notes": "Trauma therapy, family counseling, and support groups for refugees."
            },
        ],
        "Refugee Resettlement Agencies": [
            {
                "id": "gilbert_rr_001",
                "name": "Arizona Resettlement Agency - Gilbert Office",
                "address": "1950 E Baseline Rd Suite 104, Gilbert, AZ 85233",
                "phone": "(480) 633-9900",
                "website": "https://www.azresettlement.org",
                "additional_notes": "Comprehensive resettlement, employment assistance, and case management."
            },
            {
                "id": "gilbert_rr_002",
                "name": "Gilbert Refugee Integration Services",
                "address": "3133 S Higley Rd Suite 102, Gilbert, AZ 85295",
                "phone": "(480) 892-7878",
                "website": "https://www.gilbertrefugee.org",
                "additional_notes": "Job training, housing support, and cultural orientation programs."
            },
            {
                "id": "gilbert_rr_003",
                "name": "Welcome Home Resettlement - Gilbert",
                "address": "525 N Gilbert Rd Suite 201, Gilbert, AZ 85234",
                "phone": "(480) 503-8989",
                "website": "https://www.welcomehomeaz.org",
                "additional_notes": "Family services, community integration, and youth programs."
            },
        ],
        "Other Assistance": [
            {
                "id": "gilbert_oa_001",
                "name": "Gilbert Community Resources",
                "address": "119 N Gilbert Rd, Gilbert, AZ 85234",
                "phone": "(480) 497-2710",
                "website": "https://www.gilbertaz.gov/resources",
                "additional_notes": "Emergency assistance, food pantry, and utility help. Open Mon-Fri 8am-5pm."
            },
            {
                "id": "gilbert_oa_002",
                "name": "East Valley Food Bank - Gilbert",
                "address": "336 E Williams Field Rd, Gilbert, AZ 85295",
                "phone": "(480) 892-1775",
                "website": "https://www.eastvalleyfoodbank.org",
                "additional_notes": "Food distribution Tues & Sat 9am-12pm. Housing referrals available."
            },
        ],
    },
}


def normalize_location(
    zip_code: Optional[str],
    city: Optional[str],
    state: Optional[str]
) -> Optional[str]:
    """
    Normalize location input to a supported city name.

    TODO: Replace with geocoding API for production use.

    Args:
        zip_code: ZIP code if provided
        city: City name if provided
        state: State name or abbreviation if provided

    Returns:
        Normalized city name (lowercase) or None if not in supported cities
    """
    # Try ZIP code first (most specific)
    if zip_code:
        normalized_city = ZIP_TO_CITY.get(zip_code.strip())
        if normalized_city:
            return normalized_city

    # Try city name (case-insensitive)
    if city:
        city_lower = city.strip().lower()
        if city_lower in MOCK_RESOURCES_BY_CITY:
            return city_lower

    # If we get here, location is not in our supported cities
    return None


@tool
def geo_location_search(
    zip_code: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    search_radius: int = 25,
    resource_types: Optional[List[str]] = None
) -> str:
    """
    Fetch resources like legal help centers, medical centers, etc based on the type of resources
    best suited to the user's query within the vicinity of the user.

    **IMPORTANT**: Only call this tool when the user has expressed a need for local resources or services —
    either by explicitly asking (e.g., "find me a lawyer") or by describing a situation that clearly implies
    they need specific help (e.g., "I can't afford a doctor and my child is sick"). Do NOT call this tool
    for greetings, general informational questions about immigration, off-topic questions, or any message
    where the user is not expressing a need that local services can address.

    **IMPORTANT**: Use the resource_types parameter to filter results based on what the user is asking for.
    - If user asks for "legal services" → resource_types=["Legal Services"]
    - If user asks for "medical help" → resource_types=["Medical Services", "Mental Health Services"]
    - If user asks for "education" → resource_types=["Education Services"]
    - If user asks broadly for "resources" or "help" → omit resource_types to return all categories

    Args:
        zip_code: Optional ZIP code for the search location (most specific)
        city: Optional city name for the search location
        state: Optional state name or abbreviation for the search location
        search_radius: Search radius in miles (default: 25) - NOTE: Currently ignored in mock
        resource_types: Optional list of resource categories to filter by. If None, returns all categories.
                       Valid categories:
                       - "Community Activities"
                       - "Education Services"
                       - "Legal Services"
                       - "Medical Services"
                       - "Mental Health Services"
                       - "Refugee Resettlement Agencies"
                       - "Other Assistance"

    Returns:
        A JSON string containing available resources organized by category.
        Each resource includes: id, name, address, phone, website, and additional_notes.

    Examples:
        # Return only legal services
        geo_location_search(city="Tempe", state="AZ", resource_types=["Legal Services"])

        # Return medical and mental health services
        geo_location_search(city="Tempe", state="AZ", resource_types=["Medical Services", "Mental Health Services"])

        # Return all resource types
        geo_location_search(city="Tempe", state="AZ")
    """
    # Validate that at least one location parameter is provided
    if not any([zip_code, city, state]):
        return json.dumps({
            "error": "At least one location parameter (zip_code, city, or state) must be provided.",
            "supported_cities": ["Tempe, AZ", "Scottsdale, AZ", "Chandler, AZ", "Gilbert, AZ"]
        }, indent=2)

    # Normalize location to get city name
    normalized_city = normalize_location(zip_code, city, state)

    # If location not supported, return empty results
    if not normalized_city:
        location_str = zip_code or city or state
        return json.dumps({
            "search_parameters": {
                "requested_location": location_str,
                "search_radius_miles": search_radius
            },
            "total_resources": 0,
            "resources_by_category": {},
            "message": f"No resources found for location: {location_str}",
            "note": "MOCK IMPLEMENTATION: Currently only supports Tempe, Scottsdale, Chandler, and Gilbert in Arizona. This will be replaced with a real database in production."
        }, indent=2)

    # Get resources for the normalized city
    city_resources = MOCK_RESOURCES_BY_CITY[normalized_city]

    # Filter resources by requested types if specified
    if resource_types:
        # Only include categories that were requested
        filtered_resources = {
            category: resources
            for category, resources in city_resources.items()
            if category in resource_types
        }
        city_resources = filtered_resources

    # Build location string for response
    location_parts = []
    if zip_code:
        location_parts.append(f"ZIP: {zip_code}")
    if city:
        location_parts.append(f"City: {city}")
    if state:
        location_parts.append(f"State: {state}")
    location_str = ", ".join(location_parts)

    # Construct the response
    response = {
        "search_parameters": {
            "location": location_str,
            "normalized_city": normalized_city.title(),
            "search_radius_miles": search_radius,
            "resource_types_filter": resource_types if resource_types else "all"
        },
        "total_resources": sum(len(resources) for resources in city_resources.values()),
        "resources_by_category": city_resources
    }

    return json.dumps(response, indent=2)
