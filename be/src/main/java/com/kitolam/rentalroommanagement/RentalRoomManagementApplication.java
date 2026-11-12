package com.kitolam.rentalroommanagement;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@org.springframework.scheduling.annotation.EnableScheduling
public class RentalRoomManagementApplication {

    public static void main(String[] args) {
        SpringApplication.run(RentalRoomManagementApplication.class,
                args
        );
    }

}
