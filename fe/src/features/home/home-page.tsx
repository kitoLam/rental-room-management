import { FeaturedRooms } from './components/featured-rooms'
import { HeroVideo } from './components/hero-video'
import { RentalSteps } from './components/rental-steps'
import { RolePaths } from './components/role-paths'
import { Faq } from './components/faq'

export function HomePage() {
  return (
    <>
      <HeroVideo />
      <FeaturedRooms />
      <RentalSteps />
      <RolePaths />
      <Faq />
    </>
  )
}
