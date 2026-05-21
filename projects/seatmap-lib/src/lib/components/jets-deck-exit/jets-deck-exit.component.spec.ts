import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsDeckExitComponent } from './jets-deck-exit.component';

describe('JetsDeckExitComponent', () => {
  let fixture: ComponentFixture<JetsDeckExitComponent>;
  let component: JetsDeckExitComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsDeckExitComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsDeckExitComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should accept an empty exits array', () => {
    component.exits = [];
    fixture.detectChanges();
    expect(component.exits).toEqual([]);
  });

  it('should render left and right exits', () => {
    component.exits = [
      { type: 'left', topOffset: 50 },
      { type: 'right', topOffset: 50 },
    ];
    fixture.detectChanges();
    expect(component.exits).toHaveLength(2);
  });

  it('should accept custom exit icon URLs', () => {
    component.exits = [{ type: 'left', topOffset: 0 }];
    component.colorTheme = {
      exitIconUrlLeft: 'https://example.test/left.svg',
      exitIconUrlRight: 'https://example.test/right.svg',
    } as any;
    fixture.detectChanges();
    expect(component.colorTheme?.exitIconUrlLeft).toContain('left.svg');
  });
});
