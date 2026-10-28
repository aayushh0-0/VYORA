/** Demo catalogs for For Business — labeled sample data, not live rankings. */
(function (global) {
  const gyms = [
    { id: 'g1', name: 'Iron Loft Strength Lab', city: 'Jaipur', area: 'C-Scheme', demoRating: 4.7, demoReviewCount: 128, tags: ['Strength', 'Powerlifting'], about: 'Barbell-focused floor with coaching for beginners and intermediate lifters.', amenities: ['Free weights', 'Racks', 'Lockers'], hours: 'Mon–Sat 6:00–22:00 (demo)', mapsQuery: 'Iron Loft gym C-Scheme Jaipur', websiteUrl: 'https://www.google.com/search?q=Iron+Loft+gym+Jaipur', imageSeed: 11 },
    { id: 'g2', name: 'Pulse Studio Koramangala', city: 'Bengaluru', area: 'Koramangala', demoRating: 4.6, demoReviewCount: 210, tags: ['HIIT', 'Classes'], about: 'Group HIIT and conditioning classes with short time slots for busy professionals.', amenities: ['Classes', 'Showers'], hours: 'Daily 6:00–21:00 (demo)', mapsQuery: 'gym Koramangala Bengaluru', websiteUrl: 'https://www.google.com/search?q=gym+Koramangala+Bengaluru', imageSeed: 22 },
    { id: 'g3', name: 'Riverfront Run Club Hub', city: 'Ahmedabad', area: 'Riverfront', demoRating: 4.5, demoReviewCount: 96, tags: ['Running', 'Endurance'], about: 'Meetup-friendly space for easy runs and form clinics near the river path.', amenities: ['Track access', 'Mobility mats'], hours: 'Tue–Sun 5:30–20:00 (demo)', mapsQuery: 'running club Sabarmati Riverfront Ahmedabad', websiteUrl: 'https://www.google.com/search?q=running+club+Ahmedabad+Riverfront', imageSeed: 33 },
    { id: 'g4', name: 'Form Collective', city: 'Mumbai', area: 'Bandra', demoRating: 4.8, demoReviewCount: 175, tags: ['Women-friendly', 'Strength'], about: 'Coaching-led strength floor with an emphasis on technique and progressive overload.', amenities: ['Coaching', 'Changing rooms'], hours: 'Mon–Fri 6:30–21:30 (demo)', mapsQuery: 'gym Bandra Mumbai', websiteUrl: 'https://www.google.com/search?q=gym+Bandra+Mumbai', imageSeed: 44 },
    { id: 'g5', name: 'Altitude Climb & Condition', city: 'Pune', area: 'Kalyani Nagar', demoRating: 4.4, demoReviewCount: 88, tags: ['Climbing', 'Conditioning'], about: 'Hybrid climbing wall and conditioning zone for mixed training days.', amenities: ['Wall', 'TRX'], hours: 'Daily 7:00–22:00 (demo)', mapsQuery: 'climbing gym Kalyani Nagar Pune', websiteUrl: 'https://www.google.com/search?q=climbing+gym+Pune', imageSeed: 55 },
    { id: 'g6', name: 'Basecamp Functional', city: 'Hyderabad', area: 'Gachibowli', demoRating: 4.6, demoReviewCount: 140, tags: ['Functional', 'Cross-training'], about: 'Open floor for sleds, kettlebells, and mixed modal sessions.', amenities: ['Sleds', 'Kettlebells'], hours: 'Mon–Sat 5:30–21:00 (demo)', mapsQuery: 'functional gym Gachibowli Hyderabad', websiteUrl: 'https://www.google.com/search?q=functional+gym+Gachibowli', imageSeed: 66 },
    { id: 'g7', name: 'Zenith Yoga & Recovery', city: 'Jaipur', area: 'Malviya Nagar', demoRating: 4.9, demoReviewCount: 64, tags: ['Yoga', 'Recovery'], about: 'Quiet studio for mobility, yoga, and recovery-focused sessions.', amenities: ['Mats', 'Props'], hours: 'Daily 6:00–20:00 (demo)', mapsQuery: 'yoga studio Malviya Nagar Jaipur', websiteUrl: 'https://www.google.com/search?q=yoga+studio+Malviya+Nagar+Jaipur', imageSeed: 77 },
    { id: 'g8', name: 'Northline Athletic Club', city: 'Delhi', area: 'Saket', demoRating: 4.5, demoReviewCount: 201, tags: ['Strength', 'Cardio'], about: 'Full-service club floor with machines and free weights.', amenities: ['Machines', 'Cardio deck'], hours: 'Daily 5:00–23:00 (demo)', mapsQuery: 'gym Saket Delhi', websiteUrl: 'https://www.google.com/search?q=gym+Saket+Delhi', imageSeed: 88 },
    { id: 'g9', name: 'Coastline Calisthenics Yard', city: 'Chennai', area: 'Besant Nagar', demoRating: 4.3, demoReviewCount: 52, tags: ['Calisthenics', 'Outdoor'], about: 'Outdoor bars and coaching blocks near the beach road.', amenities: ['Bars', 'Open air'], hours: 'Daily sunrise–21:00 (demo)', mapsQuery: 'calisthenics Besant Nagar Chennai', websiteUrl: 'https://www.google.com/search?q=calisthenics+park+Chennai', imageSeed: 99 },
    { id: 'g10', name: 'Metro Flex Gym', city: 'Bengaluru', area: 'Indiranagar', demoRating: 4.4, demoReviewCount: 167, tags: ['Strength', 'General'], about: 'Neighborhood gym with straightforward equipment and flexible timings.', amenities: ['Free weights', 'Cardio'], hours: 'Daily 6:00–22:00 (demo)', mapsQuery: 'gym Indiranagar Bengaluru', websiteUrl: 'https://www.google.com/search?q=gym+Indiranagar+Bengaluru', imageSeed: 101 }
  ];

  const supplementPicks = [
    { id: 's1', name: 'Whey or plant protein', why: 'Convenient protein when whole-food intake is low.', search: 'whey protein supplement' },
    { id: 's2', name: 'Creatine monohydrate', why: 'Well-studied for strength training support in healthy adults.', search: 'creatine monohydrate supplement' },
    { id: 's3', name: 'Omega-3 (fish or algae)', why: 'General dietary fat often under-consumed; food first when possible.', search: 'omega-3 supplement' },
    { id: 's4', name: 'Vitamin D', why: 'Common gap in low-sun seasons; bloodwork with a clinician is wiser than guessing dose.', search: 'vitamin D3 supplement' }
  ];

  const brands = [
    { id: 'b1', name: 'Optimum Nutrition', category: 'Protein', note: 'Widely available protein powders (demo list).', search: 'Optimum Nutrition official' },
    { id: 'b2', name: 'MyProtein', category: 'Protein', note: 'Online-first sports nutrition brand (demo list).', search: 'MyProtein official site' },
    { id: 'b3', name: 'MuscleBlaze', category: 'Protein', note: 'India-focused sports nutrition brand (demo list).', search: 'MuscleBlaze official' },
    { id: 'b4', name: 'HealthKart HB', category: 'Vitamins', note: 'Common retail vitamins line in India (demo list).', search: 'HealthKart HB vitamins' },
    { id: 'b5', name: 'Now Foods', category: 'Vitamins', note: 'Broad catalog of single-ingredient supplements (demo list).', search: 'NOW Foods official' },
    { id: 'b6', name: 'Thorne', category: 'Premium', note: 'Often positioned as practitioner-oriented (demo list).', search: 'Thorne supplements official' },
    { id: 'b7', name: 'Momentous', category: 'Premium', note: 'Performance-oriented brand narrative (demo list).', search: 'Momentous supplements' },
    { id: 'b8', name: 'GNC', category: 'Retail', note: 'Long-running retail supplement chain (demo list).', search: 'GNC official' },
    { id: 'b9', name: 'Dymatize', category: 'Protein', note: 'Sports protein brand (demo list).', search: 'Dymatize ISO100' },
    { id: 'b10', name: 'Huge Supplements', category: 'Creatine', note: 'Example creatine-focused listing (demo list).', search: 'creatine monohydrate brand' }
  ];

  const merch = [
    { id: 'm1', name: 'Training t-shirt (breathable)', category: 'Apparel', blurb: 'Lightweight top for indoor sessions.', search: 'gym training t-shirt men women' },
    { id: 'm2', name: 'Mid-support training shorts', category: 'Apparel', blurb: 'Mobility-friendly shorts for lifts and classes.', search: 'training shorts gym' },
    { id: 'm3', name: 'Lifting belt (optional)', category: 'Accessories', blurb: 'For experienced lifters on heavy compounds — coaching first.', search: 'weightlifting belt' },
    { id: 'm4', name: 'Chalk or liquid chalk', category: 'Accessories', blurb: 'Grip aid for pulls and carries where gyms allow it.', search: 'liquid chalk gym' },
    { id: 'm5', name: 'Gym duffel', category: 'Bags', blurb: 'Separate shoes and damp clothes after training.', search: 'gym duffel bag' },
    { id: 'm6', name: 'Training shoes (flat sole)', category: 'Footwear', blurb: 'Stable base for strength work; not a running shoe substitute.', search: 'flat sole training shoes' },
    { id: 'm7', name: 'Running shoes (rotator)', category: 'Footwear', blurb: 'If you run outdoors, replace when cushioning collapses.', search: 'road running shoes' },
    { id: 'm8', name: 'Resistance bands set', category: 'Accessories', blurb: 'Warm-ups and travel-friendly pump work.', search: 'resistance bands set' },
    { id: 'm9', name: 'Foam roller', category: 'Recovery', blurb: 'Self-massage tool; not a medical device.', search: 'foam roller' },
    { id: 'm10', name: 'Water bottle 1L', category: 'Accessories', blurb: 'Simple hydration habit support.', search: '1 litre gym water bottle' },
    { id: 'm11', name: 'Wrist wraps', category: 'Accessories', blurb: 'Optional support for pressing days.', search: 'wrist wraps lifting' },
    { id: 'm12', name: 'Jump rope', category: 'Accessories', blurb: 'Low-cost conditioning option if joints tolerate it.', search: 'speed jump rope' }
  ];

  global.VyoraBusinessCatalog = { gyms, supplementPicks, brands, merch };
})(window);
