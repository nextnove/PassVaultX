export namespace models {
	
	export class AppConfig {
	    theme: string;
	    autoLockMinutes: number;
	    clipboardAutoDeleteSeconds: number;
	    keyDerivationAlgorithm: string;
	    language: string;
	    lockOnDeactivate: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	        this.autoLockMinutes = source["autoLockMinutes"];
	        this.clipboardAutoDeleteSeconds = source["clipboardAutoDeleteSeconds"];
	        this.keyDerivationAlgorithm = source["keyDerivationAlgorithm"];
	        this.language = source["language"];
	        this.lockOnDeactivate = source["lockOnDeactivate"];
	    }
	}
	export class Category {
	    id: string;
	    name: string;
	    sortOrder: number;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Category(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.sortOrder = source["sortOrder"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class NewPasswordItem {
	    title: string;
	    username?: string;
	    password: string;
	    url?: string;
	    notes?: string;
	    tags?: string[];
	    favorite?: boolean;
	    categoryId?: string;
	
	    static createFrom(source: any = {}) {
	        return new NewPasswordItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.url = source["url"];
	        this.notes = source["notes"];
	        this.tags = source["tags"];
	        this.favorite = source["favorite"];
	        this.categoryId = source["categoryId"];
	    }
	}
	export class PasswordItem {
	    id: string;
	    title: string;
	    username?: string;
	    password: string;
	    url?: string;
	    notes?: string;
	    tags?: string[];
	    favorite: boolean;
	    categoryId?: string;
	    lastUsedAt?: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PasswordItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.url = source["url"];
	        this.notes = source["notes"];
	        this.tags = source["tags"];
	        this.favorite = source["favorite"];
	        this.categoryId = source["categoryId"];
	        this.lastUsedAt = source["lastUsedAt"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class Vault {
	    version: string;
	    items: PasswordItem[];
	    categories: Category[];
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Vault(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.items = this.convertValues(source["items"], PasswordItem);
	        this.categories = this.convertValues(source["categories"], Category);
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace services {
	
	export class PasswordOptions {
	    length: number;
	    includeUppercase: boolean;
	    includeLowercase: boolean;
	    includeNumbers: boolean;
	    includeSymbols: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PasswordOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.length = source["length"];
	        this.includeUppercase = source["includeUppercase"];
	        this.includeLowercase = source["includeLowercase"];
	        this.includeNumbers = source["includeNumbers"];
	        this.includeSymbols = source["includeSymbols"];
	    }
	}
	export class PasswordGenerationResult {
	    password: string;
	    strength: number;
	    entropy: number;
	    generatedAt: string;
	    options: PasswordOptions;
	
	    static createFrom(source: any = {}) {
	        return new PasswordGenerationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.password = source["password"];
	        this.strength = source["strength"];
	        this.entropy = source["entropy"];
	        this.generatedAt = source["generatedAt"];
	        this.options = this.convertValues(source["options"], PasswordOptions);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

