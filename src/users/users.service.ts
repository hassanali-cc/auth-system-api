import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
    constructor(private readonly databaseService: DatabaseService) { }
    private readonly users = [
        {
            userId: 1,
            email: 'john@doe.com',
            username: 'john',
            password: 'CodingCops2025!',
            twoFactorAuthenticationSecret: 'LYXDIAI2AVYTGQQK',
            isTwoFactorAuthenticationEnabled: true,
        },
    ];

    async create(createUserDto: Prisma.UserCreateInput) {
        return this.databaseService.user.create({
            data: createUserDto
        })
    }

    async findAll() {
        return this.databaseService.user.findMany()
    }

    async findOne(id: number) {
        return this.databaseService.user.findUnique({
            where: {
                id,
            }
        })
    }

    async update(id: number, updateUserDto: Prisma.UserCreateInput) {
        return this.databaseService.user.update({
            where: {
                id,
            },
            data: updateUserDto,
        })
    }

    async remove(id: number) {
        return this.databaseService.user.delete({
            where: {
                id,
            }
        })
    }

    async findOneTest(email: string): Promise<User | undefined> {
        return this.users.find(user => user.email === email);
    }

    async setTwoFactorAuthenticationSecret(secret: string, userId: number) {
        this.users.find(user => user.userId === userId).twoFactorAuthenticationSecret = secret;
    }

    async turnOnTwoFactorAuthentication(userId: number) {
        this.users.find(user => user.userId === userId).isTwoFactorAuthenticationEnabled = true;
    }
}