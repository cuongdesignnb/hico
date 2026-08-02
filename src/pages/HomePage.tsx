import React from 'react';
import { Hero } from '../components/Hero/Hero';
import { Destinations } from '../components/Destinations/Destinations';
import { FeaturedPackages } from '../components/FeaturedPackages/FeaturedPackages';
import { HowItWorks } from '../components/HowItWorks/HowItWorks';
import { WhyHico } from '../components/WhyHico/WhyHico';
import { Testimonials } from '../components/Testimonials/Testimonials';
import { Devices } from '../components/Devices/Devices';
import { Articles } from '../components/Articles/Articles';
import { Newsletter } from '../components/Newsletter/Newsletter';

export const HomePage: React.FC = () => <>
  <Hero />
  <section id="destinations-and-packages" className="section bg-alt section-split-dest-pkg"><div className="container split-dest-pkg-container"><div className="destinations-column"><Destinations /></div><div className="packages-column"><FeaturedPackages /></div></div></section>
  <section id="how-and-why" className="section section-split-how-why"><div className="container split-how-why-container"><div className="how-column"><HowItWorks /></div><div className="why-column"><WhyHico /></div></div></section>
  <section id="reviews-and-articles" className="section bg-alt section-split-app-rev-art"><div className="container split-app-rev-art-container"><div className="testimonials-column"><Testimonials /></div><div className="articles-column"><Articles /></div></div></section>
  <Devices />
  <Newsletter />
</>;
